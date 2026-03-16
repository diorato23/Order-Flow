import { pgTable, serial, integer, text, numeric, timestamp, pgEnum } from "drizzle-orm/pg-core";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod/v4";
import { tablesTable } from "./tables";
import { menuItemsTable } from "./menuItems";

export const orderStatusEnum = pgEnum("order_status", ["pending", "preparing", "ready", "delivered", "cancelled"]);

export const ordersTable = pgTable("orders", {
  id: serial("id").primaryKey(),
  tableId: integer("table_id").notNull().references(() => tablesTable.id),
  status: orderStatusEnum("status").notNull().default("pending"),
  notes: text("notes"),
  total: numeric("total", { precision: 10, scale: 2 }).notNull().default("0"),
  createdAt: timestamp("created_at").defaultNow().notNull(),
  updatedAt: timestamp("updated_at").defaultNow().notNull(),
});

export const orderItemsTable = pgTable("order_items", {
  id: serial("id").primaryKey(),
  orderId: integer("order_id").notNull().references(() => ordersTable.id, { onDelete: "cascade" }),
  menuItemId: integer("menu_item_id").notNull().references(() => menuItemsTable.id),
  menuItemName: text("menu_item_name").notNull(),
  menuItemPrice: numeric("menu_item_price", { precision: 10, scale: 2 }).notNull(),
  quantity: integer("quantity").notNull().default(1),
  notes: text("notes"),
  subtotal: numeric("subtotal", { precision: 10, scale: 2 }).notNull(),
});

export const insertOrderSchema = createInsertSchema(ordersTable).omit({ id: true, createdAt: true, updatedAt: true });
export const insertOrderItemSchema = createInsertSchema(orderItemsTable).omit({ id: true });

export type InsertOrder = z.infer<typeof insertOrderSchema>;
export type InsertOrderItem = z.infer<typeof insertOrderItemSchema>;
export type OrderRow = typeof ordersTable.$inferSelect;
export type OrderItemRow = typeof orderItemsTable.$inferSelect;
