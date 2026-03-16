import { Router, type IRouter } from "express";
import { eq } from "drizzle-orm";
import { db, tablesTable, ordersTable, orderItemsTable, menuItemsTable } from "@workspace/db";

const router: IRouter = Router();

router.get("/tables", async (_req, res) => {
  const tables = await db.select().from(tablesTable).orderBy(tablesTable.number);
  res.json(tables);
});

router.post("/tables", async (req, res) => {
  const { number, capacity } = req.body;
  const [table] = await db.insert(tablesTable).values({ number, capacity }).returning();
  res.status(201).json(table);
});

router.get("/tables/:id", async (req, res) => {
  const id = Number(req.params.id);
  const [table] = await db.select().from(tablesTable).where(eq(tablesTable.id, id));
  if (!table) return res.status(404).json({ error: "Mesa não encontrada" });
  res.json(table);
});

router.patch("/tables/:id", async (req, res) => {
  const id = Number(req.params.id);
  const { status, guestName, capacity } = req.body;
  const updates: Record<string, unknown> = { updatedAt: new Date() };
  if (status !== undefined) updates.status = status;
  if (guestName !== undefined) updates.guestName = guestName;
  if (capacity !== undefined) updates.capacity = capacity;
  const [table] = await db.update(tablesTable).set(updates).where(eq(tablesTable.id, id)).returning();
  if (!table) return res.status(404).json({ error: "Mesa não encontrada" });
  res.json(table);
});

router.delete("/tables/:id", async (req, res) => {
  const id = Number(req.params.id);
  await db.delete(tablesTable).where(eq(tablesTable.id, id));
  res.status(204).send();
});

router.get("/tables/:id/orders", async (req, res) => {
  const tableId = Number(req.params.id);
  const orders = await db.select().from(ordersTable).where(eq(ordersTable.tableId, tableId));

  const result = await Promise.all(
    orders.map(async (order) => {
      const items = await db
        .select()
        .from(orderItemsTable)
        .where(eq(orderItemsTable.orderId, order.id));

      const [table] = await db.select().from(tablesTable).where(eq(tablesTable.id, tableId));

      return {
        ...order,
        tableNumber: table?.number ?? 0,
        total: Number(order.total),
        items: items.map((item) => ({
          ...item,
          menuItemPrice: Number(item.menuItemPrice),
          subtotal: Number(item.subtotal),
        })),
      };
    })
  );

  res.json(result);
});

export default router;
