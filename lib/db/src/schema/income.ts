import { pgTable, serial, text, numeric, timestamp, varchar, date } from "drizzle-orm/pg-core";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod/v4";

export const incomeEntriesTable = pgTable("income_entries", {
  id: serial("id").primaryKey(),
  userId: text("user_id").notNull(),
  label: text("label").notNull(),
  amount: numeric("amount", { precision: 10, scale: 2 }).notNull(),
  payDate: date("pay_date").notNull(),
  recurrence: varchar("recurrence", { length: 20 }).notNull().default("biweekly"),
  createdAt: timestamp("created_at").defaultNow().notNull(),
});

export const insertIncomeEntrySchema = createInsertSchema(incomeEntriesTable).omit({ id: true, createdAt: true });
export type InsertIncomeEntry = z.infer<typeof insertIncomeEntrySchema>;
export type IncomeEntry = typeof incomeEntriesTable.$inferSelect;
