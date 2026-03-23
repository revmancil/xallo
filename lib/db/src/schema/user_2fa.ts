import { pgTable, serial, text, boolean, timestamp } from "drizzle-orm/pg-core";

export const user2faTable = pgTable("user_2fa", {
  id: serial("id").primaryKey(),
  userId: text("user_id").notNull().unique(),
  encryptedSecret: text("encrypted_secret").notNull(),
  enabled: boolean("enabled").notNull().default(false),
  createdAt: timestamp("created_at").defaultNow().notNull(),
  enabledAt: timestamp("enabled_at"),
});

export type User2FA = typeof user2faTable.$inferSelect;
