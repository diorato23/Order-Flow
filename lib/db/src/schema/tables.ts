import { pgTable, serial, integer, varchar, timestamp, pgEnum } from "drizzle-orm/pg-core";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod/v4";

export const tableStatusEnum = pgEnum("table_status", ["available", "occupied", "reserved", "cleaning"]);

export const tablesTable = pgTable("tables", {
  id: serial("id").primaryKey(),
  number: integer("number").notNull().unique(),
  capacity: integer("capacity").notNull().default(4),
  status: tableStatusEnum("status").notNull().default("available"),
  guestName: varchar("guest_name", { length: 255 }),
  createdAt: timestamp("created_at").defaultNow().notNull(),
  updatedAt: timestamp("updated_at").defaultNow().notNull(),
});

export const insertTableSchema = createInsertSchema(tablesTable).omit({ id: true, createdAt: true, updatedAt: true });
export type InsertTable = z.infer<typeof insertTableSchema>;
export type TableRow = typeof tablesTable.$inferSelect;
