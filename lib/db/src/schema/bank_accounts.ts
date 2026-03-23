import { pgTable, serial, text, numeric, timestamp } from "drizzle-orm/pg-core";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod/v4";

export const bankAccountsTable = pgTable("bank_accounts", {
  id: serial("id").primaryKey(),
  userId: text("user_id").notNull(),
  name: text("name").notNull(),
  balance: numeric("balance", { precision: 12, scale: 2 }).notNull().default("0"),
  institution: text("institution"),
  updatedAt: timestamp("updated_at").defaultNow().notNull(),
});

export const insertBankAccountSchema = createInsertSchema(bankAccountsTable).omit({ id: true, updatedAt: true });
export type InsertBankAccount = z.infer<typeof insertBankAccountSchema>;
export type BankAccount = typeof bankAccountsTable.$inferSelect;
