import { Router, type IRouter } from "express";
import { eq, and } from "drizzle-orm";
import { db, menuItemsTable, categoriesTable } from "@workspace/db";

const router: IRouter = Router();

router.get("/menu", async (req, res) => {
  const categoryId = req.query.categoryId ? Number(req.query.categoryId) : undefined;
  const available = req.query.available !== undefined ? req.query.available === "true" : undefined;

  const items = await db
    .select({
      id: menuItemsTable.id,
      name: menuItemsTable.name,
      description: menuItemsTable.description,
      price: menuItemsTable.price,
      categoryId: menuItemsTable.categoryId,
      categoryName: categoriesTable.name,
      available: menuItemsTable.available,
      preparationTime: menuItemsTable.preparationTime,
      createdAt: menuItemsTable.createdAt,
    })
    .from(menuItemsTable)
    .leftJoin(categoriesTable, eq(menuItemsTable.categoryId, categoriesTable.id))
    .where(
      and(
        categoryId ? eq(menuItemsTable.categoryId, categoryId) : undefined,
        available !== undefined ? eq(menuItemsTable.available, available) : undefined
      )
    );

  res.json(
    items.map((item) => ({
      ...item,
      price: Number(item.price),
      categoryName: item.categoryName ?? "Sem categoria",
    }))
  );
});

router.post("/menu", async (req, res) => {
  const { name, description, price, categoryId, preparationTime } = req.body;
  const [item] = await db
    .insert(menuItemsTable)
    .values({ name, description, price: String(price), categoryId, preparationTime })
    .returning();

  const [category] = await db.select().from(categoriesTable).where(eq(categoriesTable.id, item.categoryId));

  res.status(201).json({
    ...item,
    price: Number(item.price),
    categoryName: category?.name ?? "Sem categoria",
  });
});

router.patch("/menu/:id", async (req, res) => {
  const id = Number(req.params.id);
  const { name, description, price, categoryId, available, preparationTime } = req.body;

  const updates: Record<string, unknown> = {};
  if (name !== undefined) updates.name = name;
  if (description !== undefined) updates.description = description;
  if (price !== undefined) updates.price = String(price);
  if (categoryId !== undefined) updates.categoryId = categoryId;
  if (available !== undefined) updates.available = available;
  if (preparationTime !== undefined) updates.preparationTime = preparationTime;

  const [item] = await db.update(menuItemsTable).set(updates).where(eq(menuItemsTable.id, id)).returning();
  if (!item) return res.status(404).json({ error: "Item não encontrado" });

  const [category] = await db.select().from(categoriesTable).where(eq(categoriesTable.id, item.categoryId));

  res.json({
    ...item,
    price: Number(item.price),
    categoryName: category?.name ?? "Sem categoria",
  });
});

router.delete("/menu/:id", async (req, res) => {
  const id = Number(req.params.id);
  await db.delete(menuItemsTable).where(eq(menuItemsTable.id, id));
  res.status(204).send();
});

export default router;
