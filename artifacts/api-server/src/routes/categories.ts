import { Router, type IRouter } from "express";
import { db, categoriesTable } from "@workspace/db";
import { eq } from "drizzle-orm";

const router: IRouter = Router();

router.get("/categories", async (_req, res) => {
  const categories = await db.select().from(categoriesTable).orderBy(categoriesTable.sortOrder);
  res.json(categories);
});

router.post("/categories", async (req, res) => {
  const { name, icon, sortOrder } = req.body;
  const [category] = await db.insert(categoriesTable).values({ name, icon, sortOrder }).returning();
  res.status(201).json(category);
});

export default router;
