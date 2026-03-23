import { pgTable, serial, text, integer, numeric, timestamp, varchar } from "drizzle-orm/pg-core";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod/v4";

export const billersTable = pgTable("billers", {
  id: serial("id").primaryKey(),
  userId: text("user_id").notNull(),
  name: text("name").notNull(),
  category: text("category").notNull(),
  websiteUrl: text("website_url"),
  typicalAmount: numeric("typical_amount", { precision: 10, scale: 2 }),
  dueDayOfMonth: integer("due_day_of_month"),
  recurrence: varchar("recurrence", { length: 20 }).notNull().default("monthly"),
  color: text("color"),
  icon: text("icon"),
  createdAt: timestamp("created_at").defaultNow().notNull(),
});

export const insertBillerSchema = createInsertSchema(billersTable).omit({ id: true, createdAt: true });
export type InsertBiller = z.infer<typeof insertBillerSchema>;
export type Biller = typeof billersTable.$inferSelect;
