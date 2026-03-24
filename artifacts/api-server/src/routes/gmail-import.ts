import { Router, type IRouter } from "express";
import { db } from "@workspace/db";
import { emailImportsTable, billInstancesTable } from "@workspace/db/schema";
import { eq, and, desc } from "drizzle-orm";
import { getUncachableGmailClient } from "../lib/gmail-client";
import pdfParse from "pdf-parse/lib/pdf-parse.js";

const router: IRouter = Router();

const DEMO_USER_ID = "demo";
function getUserId(req: any): string {
  return req.isAuthenticated() ? req.user.id : DEMO_USER_ID;
}

// ─── Bill data extraction (shared with pdf-upload) ───────────────────────────

function extractBillData(text: string) {
  const amountPatterns = [
    /(?:amount\s+due|total\s+due|balance\s+due|payment\s+due|total\s+amount|please\s+pay)[:\s]*\$?\s*([0-9,]+\.?[0-9]{0,2})/i,
    /(?:minimum\s+payment|amount\s+owed)[:\s]*\$?\s*([0-9,]+\.?[0-9]{0,2})/i,
    /\$\s*([0-9,]+\.[0-9]{2})\s*(?:due|owed|payable)/i,
  ];
  let amountDue: number | null = null;
  for (const p of amountPatterns) {
    const m = text.match(p);
    if (m) {
      const val = parseFloat(m[1].replace(/,/g, ""));
      if (!isNaN(val) && val > 0 && val < 100000) { amountDue = Math.round(val * 100) / 100; break; }
    }
  }

  const datePatterns = [
    /(?:due\s+date|payment\s+due|due\s+by|pay\s+by)[:\s]*([A-Za-z]+\.?\s+[0-9]{1,2},?\s+[0-9]{4})/i,
    /(?:due\s+date|payment\s+due|due\s+by)[:\s]*([0-9]{1,2}[\/\-][0-9]{1,2}[\/\-][0-9]{2,4})/i,
    /(?:due\s+date|billing\s+date)[:\s]*([0-9]{4}-[0-9]{2}-[0-9]{2})/i,
  ];
  let dueDate: string | null = null;
  for (const p of datePatterns) {
    const m = text.match(p);
    if (m) {
      const parsed = new Date(m[1]);
      dueDate = !isNaN(parsed.getTime()) ? parsed.toISOString().split("T")[0] : m[1].trim();
      break;
    }
  }

  return { amountDue, dueDate };
}

function decodeBase64(s: string) {
  return Buffer.from(s.replace(/-/g, "+").replace(/_/g, "/"), "base64").toString("utf8");
}

function extractTextFromParts(parts: any[]): { text: string; pdfAttachments: { attachmentId: string; filename: string }[] } {
  let text = "";
  const pdfAttachments: { attachmentId: string; filename: string }[] = [];

  for (const part of parts) {
    if (part.mimeType === "text/plain" && part.body?.data) {
      text += decodeBase64(part.body.data) + "\n";
    } else if (part.mimeType === "text/html" && part.body?.data && !text) {
      // Strip HTML tags as fallback
      text += decodeBase64(part.body.data).replace(/<[^>]+>/g, " ") + "\n";
    } else if (part.mimeType === "application/pdf" && part.body?.attachmentId) {
      pdfAttachments.push({ attachmentId: part.body.attachmentId, filename: part.filename || "attachment.pdf" });
    } else if (part.parts) {
      const nested = extractTextFromParts(part.parts);
      text += nested.text;
      pdfAttachments.push(...nested.pdfAttachments);
    }
  }
  return { text, pdfAttachments };
}

function extractSenderName(from: string): string {
  // "Netflix Billing <noreply@netflix.com>" → "Netflix Billing"
  const m = from.match(/^([^<]+)</);
  if (m) return m[1].trim().replace(/["']/g, "");
  // "noreply@netflix.com" → "netflix"
  const domain = from.split("@")[1]?.split(".")[0] || from;
  return domain.charAt(0).toUpperCase() + domain.slice(1);
}

// ─── GET /api/gmail/imports ───────────────────────────────────────────────────

router.get("/gmail/imports", async (req: any, res) => {
  const userId = getUserId(req);
  if (userId === DEMO_USER_ID) {
    res.json([]);
    return;
  }
  try {
    const imports = await db
      .select()
      .from(emailImportsTable)
      .where(eq(emailImportsTable.userId, userId))
      .orderBy(desc(emailImportsTable.createdAt))
      .limit(100);
    res.json(imports);
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

// ─── POST /api/gmail/sync ─────────────────────────────────────────────────────

router.post("/gmail/sync", async (req: any, res) => {
  const userId = getUserId(req);
  if (userId === DEMO_USER_ID) {
    res.status(403).json({ error: "Gmail sync is not available in demo mode. Please log in." });
    return;
  }

  try {
    const gmail = await getUncachableGmailClient();

    // Search for bill-related emails from the last 90 days
    const query = '("amount due" OR "payment due" OR "billing statement" OR "your bill" OR "please pay" OR "statement ready") newer_than:90d';
    const listRes = await gmail.users.messages.list({ userId: "me", q: query, maxResults: 50 });
    const messages = listRes.data.messages || [];

    if (messages.length === 0) {
      res.json({ synced: 0, skipped: 0, imports: [] });
      return;
    }

    // Load already-seen message IDs for this user
    const existing = await db
      .select({ gmailMessageId: emailImportsTable.gmailMessageId })
      .from(emailImportsTable)
      .where(eq(emailImportsTable.userId, userId));
    const seenIds = new Set(existing.map((e) => e.gmailMessageId));

    const newImports: typeof emailImportsTable.$inferInsert[] = [];
    let skipped = 0;

    for (const msg of messages) {
      if (!msg.id || seenIds.has(msg.id)) { skipped++; continue; }

      try {
        const full = await gmail.users.messages.get({ userId: "me", id: msg.id, format: "full" });
        const payload = full.data.payload;
        if (!payload) { skipped++; continue; }

        // Extract headers
        const headers: Record<string, string> = {};
        for (const h of payload.headers || []) {
          if (h.name && h.value) headers[h.name.toLowerCase()] = h.value;
        }
        const subject = headers["subject"] || "(no subject)";
        const from = headers["from"] || "";
        const dateStr = headers["date"];
        const receivedAt = dateStr ? new Date(dateStr) : new Date();

        // Extract body and PDF attachments
        const parts = payload.parts || (payload.body?.data ? [payload] : []);
        const { text: bodyText, pdfAttachments } = extractTextFromParts(parts);

        // Parse body text first
        let { amountDue, dueDate } = extractBillData(bodyText + " " + subject);

        // Try PDF attachments if body parsing insufficient
        if ((!amountDue || !dueDate) && pdfAttachments.length > 0) {
          for (const att of pdfAttachments.slice(0, 2)) {
            try {
              const attRes = await gmail.users.messages.attachments.get({
                userId: "me", messageId: msg.id!, id: att.attachmentId,
              });
              if (attRes.data.data) {
                const buf = Buffer.from(attRes.data.data.replace(/-/g, "+").replace(/_/g, "/"), "base64");
                const parsed = await pdfParse(buf);
                const fromPdf = extractBillData(parsed.text);
                if (!amountDue && fromPdf.amountDue) amountDue = fromPdf.amountDue;
                if (!dueDate && fromPdf.dueDate) dueDate = fromPdf.dueDate;
                if (amountDue && dueDate) break;
              }
            } catch { /* skip attachment parse errors */ }
          }
        }

        const billerHint = extractSenderName(from);

        newImports.push({
          userId,
          gmailMessageId: msg.id,
          fromEmail: from,
          subject,
          receivedAt,
          amountDue: amountDue !== null ? String(amountDue) : null,
          dueDate: dueDate || null,
          billerHint,
          status: amountDue && dueDate ? "ready" : "no_data",
        });
      } catch { skipped++; }
    }

    // Bulk insert new imports
    let inserted: any[] = [];
    if (newImports.length > 0) {
      inserted = await db.insert(emailImportsTable).values(newImports).returning();
    }

    res.json({ synced: inserted.length, skipped, imports: inserted });
  } catch (err: any) {
    console.error("Gmail sync error:", err);
    res.status(500).json({ error: err.message || "Gmail sync failed" });
  }
});

// ─── POST /api/gmail/imports/:id/create-bill ─────────────────────────────────

router.post("/gmail/imports/:id/create-bill", async (req: any, res) => {
  const userId = getUserId(req);
  const importId = parseInt(req.params.id);
  const { billerId } = req.body;

  if (!billerId) { res.status(400).json({ error: "billerId is required" }); return; }

  try {
    const [imp] = await db
      .select()
      .from(emailImportsTable)
      .where(and(eq(emailImportsTable.id, importId), eq(emailImportsTable.userId, userId)));

    if (!imp) { res.status(404).json({ error: "Import not found" }); return; }
    if (!imp.amountDue || !imp.dueDate) { res.status(400).json({ error: "Missing amount or due date" }); return; }

    const [bill] = await db.insert(billInstancesTable).values({
      userId,
      billerId: parseInt(billerId),
      amountDue: imp.amountDue,
      dueDate: imp.dueDate,
      status: "unpaid",
    }).returning();

    await db.update(emailImportsTable)
      .set({ billInstanceId: bill.id, status: "imported" })
      .where(eq(emailImportsTable.id, importId));

    res.json(bill);
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

// ─── DELETE /api/gmail/imports/:id ───────────────────────────────────────────

router.delete("/gmail/imports/:id", async (req: any, res) => {
  const userId = getUserId(req);
  const importId = parseInt(req.params.id);
  try {
    await db.delete(emailImportsTable)
      .where(and(eq(emailImportsTable.id, importId), eq(emailImportsTable.userId, userId)));
    res.json({ ok: true });
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

export default router;
