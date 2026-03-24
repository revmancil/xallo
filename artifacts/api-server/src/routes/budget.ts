import { Router, type IRouter } from "express";
import { db, budgetsTable, billInstancesTable, billersTable } from "@workspace/db";
import { eq, and, gte, lt } from "drizzle-orm";

const router: IRouter = Router();

const DEMO_USER_ID = "demo";

function getUserId(req: any): string {
  if (req.isAuthenticated()) return req.user.id;
  return DEMO_USER_ID;
}

router.get("/budgets", async (req, res) => {
  const userId = getUserId(req);
  const budgets = await db.select().from(budgetsTable).where(eq(budgetsTable.userId, userId));
  res.json(budgets);
});

router.get("/budgets/summary", async (req, res) => {
  const userId = getUserId(req);
  const monthStr = (req.query.month as string) || new Date().toISOString().slice(0, 7);
  const [year, month] = monthStr.split("-").map(Number);
  const startDate = new Date(year, month - 1, 1);
  const endDate = new Date(year, month, 1);

  const budgets = await db.select().from(budgetsTable).where(eq(budgetsTable.userId, userId));

  const spent = await db
    .select({
      category: billersTable.category,
      total: billInstancesTable.amountDue,
    })
    .from(billInstancesTable)
    .innerJoin(billersTable, eq(billInstancesTable.billerId, billersTable.id))
    .where(
      and(
        eq(billInstancesTable.userId, userId),
        eq(billInstancesTable.status, "paid"),
        gte(billInstancesTable.dueDate, startDate.toISOString().split("T")[0]),
        lt(billInstancesTable.dueDate, endDate.toISOString().split("T")[0])
      )
    );

  const spentByCategory: Record<string, number> = {};
  for (const row of spent) {
    spentByCategory[row.category] = (spentByCategory[row.category] || 0) + parseFloat(row.total as string);
  }

  const summary = budgets.map((b) => ({
    ...b,
    spent: spentByCategory[b.category] || 0,
  }));

  res.json(summary);
});

router.post("/budgets", async (req, res) => {
  const userId = getUserId(req);
  const { category, limitAmount } = req.body;
  if (!category || !limitAmount) {
    res.status(400).json({ error: "category and limitAmount required" });
    return;
  }
  const existing = await db
    .select()
    .from(budgetsTable)
    .where(and(eq(budgetsTable.userId, userId), eq(budgetsTable.category, category)));
  if (existing.length > 0) {
    res.status(409).json({ error: "Budget for this category already exists" });
    return;
  }
  const [budget] = await db
    .insert(budgetsTable)
    .values({ userId, category, limitAmount: String(limitAmount) })
    .returning();
  res.status(201).json(budget);
});

router.put("/budgets/:id", async (req, res) => {
  const userId = getUserId(req);
  const id = parseInt(req.params.id);
  const { limitAmount } = req.body;
  if (!limitAmount) {
    res.status(400).json({ error: "limitAmount required" });
    return;
  }
  const [budget] = await db
    .update(budgetsTable)
    .set({ limitAmount: String(limitAmount) })
    .where(and(eq(budgetsTable.id, id), eq(budgetsTable.userId, userId)))
    .returning();
  if (!budget) {
    res.status(404).json({ error: "Budget not found" });
    return;
  }
  res.json(budget);
});

router.delete("/budgets/:id", async (req, res) => {
  const userId = getUserId(req);
  const id = parseInt(req.params.id);
  await db.delete(budgetsTable).where(and(eq(budgetsTable.id, id), eq(budgetsTable.userId, userId)));
  res.json({ success: true });
});

export default router;
