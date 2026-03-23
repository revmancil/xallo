import { db, securityLogsTable } from "@workspace/db";
import type { Request } from "express";

export async function logSecurityEvent(
  req: Request | null,
  userId: string,
  action: string,
  metadata?: Record<string, unknown>
) {
  try {
    await db.insert(securityLogsTable).values({
      userId,
      action,
      ipAddress: req ? (req.headers["x-forwarded-for"] as string || req.socket.remoteAddress || null) : null,
      userAgent: req ? (req.headers["user-agent"] || null) : null,
      metadata: metadata || null,
    });
  } catch {
  }
}
