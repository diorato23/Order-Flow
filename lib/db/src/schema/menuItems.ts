import { pgTable, serial, varchar, text, numeric, integer, boolean, timestamp } from "drizzle-orm/pg-core";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod/v4";
import { categoriesTable } from "./categories";

export const menuItemsTable = pgTable("menu_items", {
  id: serial("id").primaryKey(),
  name: varchar("name", { length: 200 }).notNull(),
  description: text("description"),
  price: numeric("price", { precision: 10, scale: 2 }).notNull(),
  categoryId: integer("category_id").notNull().references(() => categoriesTable.id),
  available: boolean("available").notNull().default(true),
  preparationTime: integer("preparation_time"),
  createdAt: timestamp("created_at").defaultNow().notNull(),
});

export const insertMenuItemSchema = createInsertSchema(menuItemsTable).omit({ id: true, createdAt: true });
export type InsertMenuItem = z.infer<typeof insertMenuItemSchema>;
export type MenuItemRow = typeof menuItemsTable.$inferSelect;
