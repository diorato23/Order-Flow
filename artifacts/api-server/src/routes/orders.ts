import { Router, type IRouter } from "express";
import { eq, and, count, sum, desc } from "drizzle-orm";
import { db, ordersTable, orderItemsTable, tablesTable, menuItemsTable } from "@workspace/db";

const router: IRouter = Router();

async function enrichOrder(order: typeof ordersTable.$inferSelect) {
  const items = await db.select().from(orderItemsTable).where(eq(orderItemsTable.orderId, order.id));
  const [table] = await db.select().from(tablesTable).where(eq(tablesTable.id, order.tableId));

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
}

router.get("/orders", async (req, res) => {
  const status = req.query.status as string | undefined;
  const tableId = req.query.tableId ? Number(req.query.tableId) : undefined;

  const orders = await db
    .select()
    .from(ordersTable)
    .where(
      and(
        status ? eq(ordersTable.status, status as "pending" | "preparing" | "ready" | "delivered" | "cancelled") : undefined,
        tableId ? eq(ordersTable.tableId, tableId) : undefined
      )
    )
    .orderBy(desc(ordersTable.createdAt));

  const enriched = await Promise.all(orders.map(enrichOrder));
  res.json(enriched);
});

router.post("/orders", async (req, res) => {
  const { tableId, items, notes } = req.body as {
    tableId: number;
    items: { menuItemId: number; quantity: number; notes?: string }[];
    notes?: string;
  };

  const menuItems = await Promise.all(
    items.map(async (item) => {
      const [mi] = await db.select().from(menuItemsTable).where(eq(menuItemsTable.id, item.menuItemId));
      return { ...mi, quantity: item.quantity, notes: item.notes };
    })
  );

  const total = menuItems.reduce((sum, mi) => sum + Number(mi.price) * mi.quantity, 0);

  const [order] = await db
    .insert(ordersTable)
    .values({ tableId, notes, total: String(total) })
    .returning();

  await Promise.all(
    menuItems.map((mi) =>
      db.insert(orderItemsTable).values({
        orderId: order.id,
        menuItemId: mi.id!,
        menuItemName: mi.name!,
        menuItemPrice: String(mi.price),
        quantity: mi.quantity,
        notes: mi.notes,
        subtotal: String(Number(mi.price) * mi.quantity),
      })
    )
  );

  await db
    .update(tablesTable)
    .set({ status: "occupied", updatedAt: new Date() })
    .where(eq(tablesTable.id, tableId));

  const enriched = await enrichOrder(order);
  res.status(201).json(enriched);
});

router.get("/orders/:id", async (req, res) => {
  const id = Number(req.params.id);
  const [order] = await db.select().from(ordersTable).where(eq(ordersTable.id, id));
  if (!order) return res.status(404).json({ error: "Pedido não encontrado" });
  res.json(await enrichOrder(order));
});

router.patch("/orders/:id", async (req, res) => {
  const id = Number(req.params.id);
  const { status, notes } = req.body;
  const updates: Record<string, unknown> = { updatedAt: new Date() };
  if (status !== undefined) updates.status = status;
  if (notes !== undefined) updates.notes = notes;

  const [order] = await db.update(ordersTable).set(updates).where(eq(ordersTable.id, id)).returning();
  if (!order) return res.status(404).json({ error: "Pedido não encontrado" });
  res.json(await enrichOrder(order));
});

router.delete("/orders/:id", async (req, res) => {
  const id = Number(req.params.id);
  await db.delete(ordersTable).where(eq(ordersTable.id, id));
  res.status(204).send();
});

router.get("/stats", async (_req, res) => {
  const [totalOrdersRow] = await db.select({ count: count() }).from(ordersTable);
  const [revenueRow] = await db
    .select({ total: sum(ordersTable.total) })
    .from(ordersTable)
    .where(eq(ordersTable.status, "delivered"));

  const totalOrders = totalOrdersRow?.count ?? 0;
  const totalRevenue = Number(revenueRow?.total ?? 0);
  const averageTicket = totalOrders > 0 ? totalRevenue / Number(totalOrders) : 0;

  const [activeOrdersRow] = await db
    .select({ count: count() })
    .from(ordersTable)
    .where(
      and(
        eq(ordersTable.status, "pending")
      )
    );

  const allTables = await db.select().from(tablesTable);
  const occupiedTables = allTables.filter((t) => t.status === "occupied").length;

  const topItemsRaw = await db
    .select({
      menuItemId: orderItemsTable.menuItemId,
      name: orderItemsTable.menuItemName,
      count: count(),
      revenue: sum(orderItemsTable.subtotal),
    })
    .from(orderItemsTable)
    .groupBy(orderItemsTable.menuItemId, orderItemsTable.menuItemName)
    .orderBy(desc(count()))
    .limit(5);

  res.json({
    totalOrders: Number(totalOrders),
    totalRevenue,
    averageTicket,
    activeOrders: Number(activeOrdersRow?.count ?? 0),
    occupiedTables,
    totalTables: allTables.length,
    topItems: topItemsRaw.map((item) => ({
      menuItemId: item.menuItemId,
      name: item.name,
      count: Number(item.count),
      revenue: Number(item.revenue ?? 0),
    })),
  });
});

export default router;
