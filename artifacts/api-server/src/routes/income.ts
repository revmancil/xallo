import { Router, type IRouter } from "express";
import { db, incomeEntriesTable } from "@workspace/db";
import { eq, and } from "drizzle-orm";

const router: IRouter = Router();

const DEMO_USER_ID = "demo";

function getUserId(req: any): string {
  if (req.isAuthenticated()) return req.user.id;
  return DEMO_USER_ID;
}

function parseCreateBody(body: any) {
  const { label, amount, payDate, recurrence } = body ?? {};
  if (typeof label !== "string" || label.trim() === "") {
    return { error: "label is required" };
  }
  if (amount == null || isNaN(Number(amount))) {
    return { error: "amount is required and must be a number" };
  }
  if (typeof payDate !== "string" || payDate.trim() === "") {
    return { error: "payDate is required" };
  }
  const validRecurrences = ["weekly", "biweekly", "monthly", "one-time"];
  if (!validRecurrences.includes(recurrence)) {
    return { error: "recurrence must be one of: weekly, biweekly, monthly, one-time" };
  }
  return {
    data: {
      label: label.trim(),
      amount: String(Number(amount)),
      payDate: payDate.trim(),
      recurrence,
    },
  };
}

router.get("/income", async (req, res) => {
  const userId = getUserId(req);
  const entries = await db.select().from(incomeEntriesTable).where(eq(incomeEntriesTable.userId, userId));
  res.json(entries);
});

router.post("/income", async (req, res) => {
  const userId = getUserId(req);
  const parsed = parseCreateBody(req.body);
  if ("error" in parsed) {
    res.status(400).json({ error: parsed.error });
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
