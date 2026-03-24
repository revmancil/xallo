import { pgTable, serial, text, numeric, date, timestamp, integer } from "drizzle-orm/pg-core";

export const emailImportsTable = pgTable("email_imports", {
  id: serial("id").primaryKey(),
  userId: text("user_id").notNull(),
  gmailMessageId: text("gmail_message_id").notNull(),
  fromEmail: text("from_email"),
  subject: text("subject"),
  receivedAt: timestamp("received_at"),
  amountDue: numeric("amount_due", { precision: 10, scale: 2 }),
  dueDate: date("due_date"),
  billerHint: text("biller_hint"),
  billInstanceId: integer("bill_instance_id"),
  status: text("status").notNull().default("pending"),
  createdAt: timestamp("created_at").defaultNow().notNull(),
});

export type EmailImport = typeof emailImportsTable.$inferSelect;
