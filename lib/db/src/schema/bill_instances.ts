import { pgTable, serial, text, integer, numeric, timestamp, varchar, date } from "drizzle-orm/pg-core";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod/v4";
import { billersTable } from "./billers";

export const billInstancesTable = pgTable("bill_instances", {
  id: serial("id").primaryKey(),
  billerId: integer("biller_id").notNull().references(() => billersTable.id, { onDelete: "cascade" }),
  userId: text("user_id").notNull(),
  amountDue: numeric("amount_due", { precision: 10, scale: 2 }).notNull(),
  dueDate: date("due_date").notNull(),
  status: varchar("status", { length: 20 }).notNull().default("unpaid"),
  confirmationNumber: text("confirmation_number"),
  paidAt: timestamp("paid_at"),
  createdAt: timestamp("created_at").defaultNow().notNull(),
});

export const insertBillInstanceSchema = createInsertSchema(billInstancesTable).omit({ id: true, createdAt: true });
export type InsertBillInstance = z.infer<typeof insertBillInstanceSchema>;
export type BillInstance = typeof billInstancesTable.$inferSelect;
