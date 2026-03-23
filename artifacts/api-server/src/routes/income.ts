import { Router, type IRouter } from "express";
import { db, incomeEntriesTable } from "@workspace/db";
import { eq, and } from "drizzle-orm";
import { CreateIncomeEntryBody } from "@workspace/api-zod";

const router: IRouter = Router();

const DEMO_USER_ID = "demo";

function getUserId(req: any): string {
  if (req.isAuthenticated()) return req.user.id;
  return DEMO_USER_ID;
}

router.get("/income", async (req, res) => {
  const userId = getUserId(req);
  const entries = await db.select().from(incomeEntriesTable).where(eq(incomeEntriesTable.userId, userId));
  res.json(entries);
});

router.post("/income", async (req, res) => {
  const userId = getUserId(req);
  const parsed = CreateIncomeEntryBody.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: "Invalid request body" });
    return;
  }
  const [entry] = await db
    .insert(incomeEntriesTable)
    .values({ ...parsed.data, userId })
    .returning();
  res.status(201).json(entry);
});

router.delete("/income/:incomeId", async (req, res) => {
  const userId = getUserId(req);
  const incomeId = parseInt(req.params.incomeId);
  await db
    .delete(incomeEntriesTable)
    .where(and(eq(incomeEntriesTable.id, incomeId), eq(incomeEntriesTable.userId, userId)));
  res.json({ success: true });
});

export default router;
