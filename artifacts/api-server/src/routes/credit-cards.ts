import { Router, type IRouter } from "express";
import { db } from "@workspace/db";
import { creditCardsTable } from "@workspace/db/schema";
import { eq, and } from "drizzle-orm";
const router: IRouter = Router();
const DEMO_USER_ID = "demo";

function getUserId(req: any): string {
  return req.isAuthenticated() ? req.user.id : DEMO_USER_ID;
}

function parseCardBody(body: any, requireName = true) {
  const { name, institution, lastFour, creditLimit, currentBalance, apr, statementDueDay, minimumPayment, color } = body;
  if (requireName && (!name || typeof name !== "string")) return null;
  return {
    name: name as string,
    institution: institution || null,
    lastFour: lastFour ? String(lastFour).slice(0, 4) : null,
    creditLimit: parseFloat(creditLimit) || 0,
    currentBalance: parseFloat(currentBalance) || 0,
    apr: apr != null && apr !== "" ? parseFloat(apr) : null,
    statementDueDay: statementDueDay ? parseInt(statementDueDay) : null,
    minimumPayment: minimumPayment != null && minimumPayment !== "" ? parseFloat(minimumPayment) : null,
    color: color || "#6366f1",
  };
}

// ─── GET /api/credit-cards ────────────────────────────────────────────────────
router.get("/credit-cards", async (req: any, res) => {
  const userId = getUserId(req);
  try {
    const cards = await db
      .select()
      .from(creditCardsTable)
      .where(eq(creditCardsTable.userId, userId))
      .orderBy(creditCardsTable.createdAt);
    res.json(cards);
  } catch (e: any) {
    res.status(500).json({ error: e.message });
  }
});

// ─── POST /api/credit-cards ───────────────────────────────────────────────────
router.post("/credit-cards", async (req: any, res) => {
  const userId = getUserId(req);
  const body = parseCardBody(req.body);
  if (!body) { res.status(400).json({ error: "name and creditLimit are required" }); return; }
  const { creditLimit, currentBalance, apr, minimumPayment, ...rest } = body;
  try {
    const [card] = await db
      .insert(creditCardsTable)
      .values({
        userId,
        creditLimit: String(creditLimit),
        currentBalance: String(currentBalance),
        apr: apr != null ? String(apr) : null,
        minimumPayment: minimumPayment != null ? String(minimumPayment) : null,
        ...rest,
      })
      .returning();
    res.status(201).json(card);
  } catch (e: any) {
    res.status(500).json({ error: e.message });
  }
});

// ─── PUT /api/credit-cards/:id ────────────────────────────────────────────────
router.put("/credit-cards/:id", async (req: any, res) => {
  const userId = getUserId(req);
  const cardId = parseInt(req.params.id);
  const body = parseCardBody(req.body, false);
  if (!body) { res.status(400).json({ error: "Invalid request" }); return; }
  const { creditLimit, currentBalance, apr, minimumPayment, ...rest } = body;
  try {
    const [card] = await db
      .update(creditCardsTable)
      .set({
        ...rest,
        creditLimit: String(creditLimit),
        currentBalance: String(currentBalance),
        apr: apr != null ? String(apr) : null,
        minimumPayment: minimumPayment != null ? String(minimumPayment) : null,
        updatedAt: new Date(),
      })
      .where(and(eq(creditCardsTable.id, cardId), eq(creditCardsTable.userId, userId)))
      .returning();
    if (!card) { res.status(404).json({ error: "Card not found" }); return; }
    res.json(card);
  } catch (e: any) {
    res.status(500).json({ error: e.message });
  }
});

// ─── DELETE /api/credit-cards/:id ─────────────────────────────────────────────
router.delete("/credit-cards/:id", async (req: any, res) => {
  const userId = getUserId(req);
  const cardId = parseInt(req.params.id);
  try {
    await db
      .delete(creditCardsTable)
      .where(and(eq(creditCardsTable.id, cardId), eq(creditCardsTable.userId, userId)));
    res.json({ ok: true });
  } catch (e: any) {
    res.status(500).json({ error: e.message });
  }
});

export default router;
