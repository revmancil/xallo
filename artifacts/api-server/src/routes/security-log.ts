import { Router, type IRouter } from "express";
import { db, securityLogsTable, user2faTable } from "@workspace/db";
import { eq, desc } from "drizzle-orm";
import { logSecurityEvent } from "../lib/security-logger";
import speakeasy from "speakeasy";
import QRCode from "qrcode";
import { encrypt, decrypt } from "../lib/encryption";

const router: IRouter = Router();

const DEMO_USER_ID = "demo";
function getUserId(req: any): string {
  if (req.isAuthenticated()) return req.user.id;
  return DEMO_USER_ID;
}

router.get("/security/logs", async (req, res) => {
  const userId = getUserId(req);
  const logs = await db
    .select()
    .from(securityLogsTable)
    .where(eq(securityLogsTable.userId, userId))
    .orderBy(desc(securityLogsTable.createdAt))
    .limit(100);
  res.json(logs);
});

router.post("/security/log", async (req, res) => {
  const userId = getUserId(req);
  const { action, metadata } = req.body;
  await logSecurityEvent(req, userId, action, metadata);
  res.json({ success: true });
});

router.get("/security/2fa/status", async (req, res) => {
  const userId = getUserId(req);
  const [record] = await db
    .select({ enabled: user2faTable.enabled, createdAt: user2faTable.createdAt })
    .from(user2faTable)
    .where(eq(user2faTable.userId, userId));
  res.json({ enabled: record?.enabled || false, configuredAt: record?.createdAt || null });
});

router.post("/security/2fa/setup", async (req, res) => {
  const userId = getUserId(req);

  const secret = speakeasy.generateSecret({
    name: `PrismClone (${userId})`,
    issuer: "PrismClone",
    length: 32,
  });

  const encryptedSecret = encrypt(secret.base32);

  const existing = await db
    .select()
    .from(user2faTable)
    .where(eq(user2faTable.userId, userId));

  if (existing.length > 0) {
    await db
      .update(user2faTable)
      .set({ encryptedSecret, enabled: false })
      .where(eq(user2faTable.userId, userId));
  } else {
    await db.insert(user2faTable).values({
      userId,
      encryptedSecret,
      enabled: false,
    });
  }

  const qrCodeUrl = await QRCode.toDataURL(secret.otpauth_url!);

  res.json({
    qrCodeUrl,
    manualKey: secret.base32,
    otpauthUrl: secret.otpauth_url,
  });
});

router.post("/security/2fa/verify", async (req, res) => {
  const userId = getUserId(req);
  const { token } = req.body;

  const [record] = await db
    .select()
    .from(user2faTable)
    .where(eq(user2faTable.userId, userId));

  if (!record) {
    res.status(404).json({ error: "2FA not set up." });
    return;
  }

  const secret = decrypt(record.encryptedSecret);
  const verified = speakeasy.totp.verify({
    secret,
    encoding: "base32",
    token: String(token),
    window: 2,
  });

  if (!verified) {
    res.status(400).json({ error: "Invalid code. Please try again." });
    return;
  }

  await db
    .update(user2faTable)
    .set({ enabled: true, enabledAt: new Date() })
    .where(eq(user2faTable.userId, userId));

  await logSecurityEvent(req, userId, "2fa_enabled", {});
  res.json({ success: true, message: "Two-factor authentication enabled." });
});

router.post("/security/2fa/disable", async (req, res) => {
  const userId = getUserId(req);
  await db
    .update(user2faTable)
    .set({ enabled: false })
    .where(eq(user2faTable.userId, userId));
  await logSecurityEvent(req, userId, "2fa_disabled", {});
  res.json({ success: true });
});

export default router;
