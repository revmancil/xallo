// Email import via AgentMail — bills-prismclone@agentmail.to
// Users forward bill emails to that address; this route syncs and parses them.
import { Router, type IRouter } from "express";
import { db } from "@workspace/db";
import { emailImportsTable, billInstancesTable } from "@workspace/db/schema";
import { eq, and, desc } from "drizzle-orm";
import { listMessages, getMessage, getBillsInbox, getInboxInfo } from "../lib/agentmail-client";
import pdfParse from "pdf-parse/lib/pdf-parse.js";

const router: IRouter = Router();

const DEMO_USER_ID = "demo";
function getUserId(req: any): string {
  return req.isAuthenticated() ? req.user.id : DEMO_USER_ID;
}

// ─── Bill data extraction ─────────────────────────────────────────────────────

const MONTHS = "January|February|March|April|May|June|July|August|September|October|November|December";

function extractAmountDue(flat: string): number | null {
  const patterns = [
    /(?:total\s+amount\s+due|amount\s+due|total\s+due|balance\s+due|payment\s+due|please\s+pay|amount\s+owed)[:\s]*\$?\s*([0-9,]+\.?[0-9]{0,2})/i,
    /(?:minimum\s+payment|min\s+payment)[:\s]*\$?\s*([0-9,]+\.?[0-9]{0,2})/i,
    /\$\s*([0-9,]+\.[0-9]{2})\s*(?:due|owed|payable)/i,
  ];
  for (const p of patterns) {
    const m = flat.match(p);
    if (m) {
      const val = parseFloat(m[1].replace(/,/g, ""));
      if (!isNaN(val) && val > 0 && val < 100000) return Math.round(val * 100) / 100;
    }
  }
  return null;
}

function extractDueDate(flat: string, allowFloating = false): string | null {
  // Explicit labeled patterns (safest — require a label like "Due Date:")
  const labeled = [
    /(?:due\s+date|payment\s+due|due\s+by|pay\s+by)[:\s]+([A-Za-z]+\.?\s+[0-9]{1,2},?\s+[0-9]{4})/i,
    /(?:due\s+date|payment\s+due|due\s+by)[:\s]+([0-9]{1,2}[\/\-][0-9]{1,2}[\/\-][0-9]{2,4})/i,
    /(?:due\s+date|billing\s+date)[:\s]+([0-9]{4}-[0-9]{2}-[0-9]{2})/i,
  ];
  for (const p of labeled) {
    const m = flat.match(p);
    if (m) {
      const parsed = new Date(m[1]);
      if (!isNaN(parsed.getTime())) return parsed.toISOString().split("T")[0];
    }
  }

  // Floating fallback (only enabled for PDFs — avoids picking up email "Sent:" dates)
  if (allowFloating) {
    const floating = new RegExp(`((?:${MONTHS})\\s+\\d{1,2},?\\s+\\d{4})`, "ig");
    const allDates: Date[] = [];
    let fm: RegExpExecArray | null;
    while ((fm = floating.exec(flat)) !== null) {
      const d = new Date(fm[1]);
      if (!isNaN(d.getTime())) allDates.push(d);
    }
    if (allDates.length > 0) {
      allDates.sort((a, b) => a.getTime() - b.getTime());
      return allDates[0].toISOString().split("T")[0];
    }
  }

  return null;
}

function extractBillData(text: string, allowFloatingDate = false) {
  const flat = text.replace(/\n+/g, " ").replace(/\s{2,}/g, " ");
  return {
    amountDue: extractAmountDue(flat),
    dueDate: extractDueDate(flat, allowFloatingDate),
  };
}

function extractBillerHint(from: string, subject: string): string {
  // For forwarded emails, extract the biller from subject (e.g. "Fw: City of Frisco, TX Utility Bill")
  const fwMatch = subject.match(/^(?:Fw:|Fwd:)\s*(.+?)(?:\s*-\s*|\s*bill\b|\s*statement\b|\s*invoice\b|$)/i);
  if (fwMatch) return fwMatch[1].trim();

  // Try to extract from sender name
  const nameMatch = from.match(/^([^<]+)</);
  if (nameMatch) {
    const name = nameMatch[1].trim().replace(/["']/g, "");
    // Prefer domain-derived names for no-reply addresses
    if (/no.?reply|donotreply|notification|billing|invoice/i.test(name)) {
      const domain = from.match(/@([^>]+)/)?.[1]?.split(".").slice(0, -1).join(".");
      if (domain) return domain.charAt(0).toUpperCase() + domain.slice(1);
    }
    return name;
  }

  // Fallback to domain
  const domain = from.split("@")[1]?.split(".")[0] || from;
  return domain.charAt(0).toUpperCase() + domain.slice(1);
}

function stripHtml(html: string): string {
  return html.replace(/<[^>]+>/g, " ").replace(/\s+/g, " ").trim();
}

// ─── GET /api/gmail/inbox ─────────────────────────────────────────────────────
// Returns the forwarding address users should send bills to

router.get("/gmail/inbox", async (_req, res) => {
  res.json({
    email: getBillsInbox(),
    displayName: "PrismClone Bills",
  });
});

// ─── GET /api/gmail/imports ───────────────────────────────────────────────────

router.get("/gmail/imports", async (req: any, res) => {
  const userId = getUserId(req);
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
// Syncs the shared AgentMail bills inbox and stores new imports for this user

router.post("/gmail/sync", async (req: any, res) => {
  const userId = getUserId(req);

  try {
    const inbox = getBillsInbox();
    const messages = await listMessages(inbox, 50);

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
      if (seenIds.has(msg.message_id)) { skipped++; continue; }

      // Get full message body when available
      const full = await getMessage(inbox, msg.message_id);
      const bodyText = full?.text
        || (full?.html ? stripHtml(full.html) : "")
        || msg.preview
        || "";

      const searchText = `${msg.subject} ${bodyText}`;
      // Parse body with strict date matching only (no floating — avoids "Sent: March 16" in forwards)
      let { amountDue, dueDate } = extractBillData(searchText, false);

      // Always try PDF attachments — PDF data is authoritative and overrides email body
      if (full?.attachments?.length) {
        for (const att of full.attachments.filter((a: any) => a.content_type === "application/pdf").slice(0, 2)) {
          try {
            // Step 1: get attachment metadata which includes a signed download_url
            const metaRes = await fetch(
              `https://api.agentmail.to/v0/inboxes/${encodeURIComponent(inbox)}/messages/${encodeURIComponent(msg.message_id)}/attachments/${att.attachment_id}`,
              { headers: { Authorization: `Bearer ${process.env.AGENTMAIL_API_KEY}` } }
            );
            if (!metaRes.ok) continue;
            const meta = await metaRes.json() as any;
            const downloadUrl = meta.download_url;
            if (!downloadUrl) continue;

            // Step 2: download the actual PDF binary from the CDN URL
            const pdfRes = await fetch(downloadUrl);
            if (!pdfRes.ok) continue;
            const buf = Buffer.from(await pdfRes.arrayBuffer());
            const parsed = await pdfParse(buf);
            // Parse PDF with floating date allowed; PDF always wins over email body
            const fromPdf = extractBillData(parsed.text, true);
            if (fromPdf.amountDue) amountDue = fromPdf.amountDue;
            if (fromPdf.dueDate) dueDate = fromPdf.dueDate;
            if (amountDue && dueDate) break;
          } catch (e: any) {
            console.error("PDF parse error:", e.message);
          }
        }
      }

      const billerHint = extractBillerHint(msg.from, msg.subject);
      const receivedAt = new Date(msg.timestamp);

      newImports.push({
        userId,
        gmailMessageId: msg.message_id,
        fromEmail: msg.from,
        subject: msg.subject,
        receivedAt,
        amountDue: amountDue !== null ? String(amountDue) : null,
        dueDate: dueDate || null,
        billerHint,
        status: amountDue && dueDate ? "ready" : "no_data",
      });
    }

    let inserted: any[] = [];
    if (newImports.length > 0) {
      inserted = await db.insert(emailImportsTable).values(newImports).returning();
    }

    res.json({ synced: inserted.length, skipped, imports: inserted });
  } catch (err: any) {
    console.error("AgentMail sync error:", err);
    res.status(500).json({ error: err.message || "Email sync failed" });
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
