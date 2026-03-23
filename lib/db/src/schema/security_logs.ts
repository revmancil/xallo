import { pgTable, serial, text, timestamp, jsonb } from "drizzle-orm/pg-core";

export const securityLogsTable = pgTable("security_logs", {
  id: serial("id").primaryKey(),
  userId: text("user_id").notNull(),
  action: text("action").notNull(),
  ipAddress: text("ip_address"),
  userAgent: text("user_agent"),
  metadata: jsonb("metadata"),
  createdAt: timestamp("created_at").defaultNow().notNull(),
});

export type SecurityLog = typeof securityLogsTable.$inferSelect;
