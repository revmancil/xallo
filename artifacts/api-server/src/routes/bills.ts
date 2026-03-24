import { Router, type IRouter } from "express";
import { db, billInstancesTable, billersTable } from "@workspace/db";
import { eq, and, sql, desc } from "drizzle-orm";
import { CreateBillInstanceBody, UpdateBillInstanceBody } from "@workspace/api-zod";

const router: IRouter = Router();

const DEMO_USER_ID = "demo";

function getUserId(req: any): string {
  if (req.isAuthenticated()) return req.user.id;
  return DEMO_USER_ID;
}

router.get("/bills", async (req, res) => {
  const userId = getUserId(req);
  const { month, year } = req.query;

  let conditions = [eq(billInstancesTable.userId, userId)];

  if (month && year) {
    const m = parseInt(month as string);
    const y = parseInt(year as string);
    conditions.push(
      sql`EXTRACT(MONTH FROM ${billInstancesTable.dueDate}) = ${m} AND EXTRACT(YEAR FROM ${billInstancesTable.dueDate}) = ${y}` as any
    );
  }

  const bills = await db
    .select({
      id: billInstancesTable.id,
      billerId: billInstancesTable.billerId,
      userId: billInstancesTable.userId,
      amountDue: billInstancesTable.amountDue,
      dueDate: billInstancesTable.dueDate,
      status: billInstancesTable.status,
      confirmationNumber: billInstancesTable.confirmationNumber,
      paidAt: billInstancesTable.paidAt,
      createdAt: billInstancesTable.createdAt,
      biller: {
        id: billersTable.id,
        userId: billersTable.userId,
        name: billersTable.name,
        category: billersTable.category,
        websiteUrl: billersTable.websiteUrl,
        typicalAmount: billersTable.typicalAmount,
        dueDayOfMonth: billersTable.dueDayOfMonth,
        recurrence: billersTable.recurrence,
        color: billersTable.color,
        icon: billersTable.icon,
        createdAt: billersTable.createdAt,
      },
    })
    .from(billInstancesTable)
    .leftJoin(billersTable, eq(billInstancesTable.billerId, billersTable.id))
    .where(and(...conditions));

  res.json(bills);
});

router.post("/bills", async (req, res) => {
  const userId = getUserId(req);
  const parsed = CreateBillInstanceBody.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: "Invalid request body" });
    return;
  }
  const [bill] = await db
    .insert(billInstancesTable)
    .values({ ...parsed.data, userId })
    .returning();
  res.status(201).json(bill);
});

router.put("/bills/:billId", async (req, res) => {
  const userId = getUserId(req);
  const billId = parseInt(req.params.billId);
  const parsed = UpdateBillInstanceBody.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: "Invalid request body" });
    return;
  }
  const [bill] = await db
    .update(billInstancesTable)
    .set(parsed.data)
    .where(and(eq(billInstancesTable.id, billId), eq(billInstancesTable.userId, userId)))
    .returning();
  if (!bill) {
    res.status(404).json({ error: "Bill not found" });
    return;
  }
  res.json(bill);
});

router.delete("/bills/:billId", async (req, res) => {
  const userId = getUserId(req);
  const billId = parseInt(req.params.billId);
  await db
    .delete(billInstancesTable)
    .where(and(eq(billInstancesTable.id, billId), eq(billInstancesTable.userId, userId)));
  res.json({ success: true });
});

function advanceDate(date: Date, recurrence: string): Date {
  const next = new Date(date);
  switch (recurrence) {
    case "monthly":    next.setMonth(next.getMonth() + 1); break;
    case "biweekly":  next.setDate(next.getDate() + 14); break;
    case "weekly":    next.setDate(next.getDate() + 7); break;
    case "quarterly": next.setMonth(next.getMonth() + 3); break;
    case "yearly":    next.setFullYear(next.getFullYear() + 1); break;
    default:          next.setMonth(next.getMonth() + 1);
  }
  return next;
}

function daysApart(a: Date, b: Date): number {
  return Math.abs(a.getTime() - b.getTime()) / (1000 * 60 * 60 * 24);
}

router.post("/bills/generate-recurring", async (req, res) => {
  const userId = getUserId(req);

  const billersList = await db
    .select()
    .from(billersTable)
    .where(eq(billersTable.userId, userId));

  const recurringBillers = billersList.filter(
    b => b.recurrence !== "one-time" && b.typicalAmount != null
  );

  const today = new Date();
  today.setHours(0, 0, 0, 0);
  const cutoff = new Date(today);
  cutoff.setMonth(cutoff.getMonth() + 3);

  const created: { biller: string; dueDate: string }[] = [];
  const skipped: string[] = [];

  for (const biller of recurringBillers) {
    const existingBills = await db
      .select({ dueDate: billInstancesTable.dueDate })
      .from(billInstancesTable)
      .where(and(eq(billInstancesTable.billerId, biller.id), eq(billInstancesTable.userId, userId)));

    const existingDates = existingBills.map(b => new Date(b.dueDate));

    const latestBills = await db
      .select({ dueDate: billInstancesTable.dueDate })
      .from(billInstancesTable)
      .where(and(eq(billInstancesTable.billerId, biller.id), eq(billInstancesTable.userId, userId)))
      .orderBy(desc(billInstancesTable.dueDate))
      .limit(1);

    let nextDate: Date;
    if (latestBills.length > 0) {
      nextDate = advanceDate(new Date(latestBills[0].dueDate), biller.recurrence);
    } else {
      if (biller.recurrence === "monthly" && biller.dueDayOfMonth) {
        nextDate = new Date(today.getFullYear(), today.getMonth(), biller.dueDayOfMonth);
        if (nextDate < today) nextDate = advanceDate(nextDate, "monthly");
      } else {
        nextDate = new Date(today);
      }
    }

    let attempts = 0;
    while (nextDate <= cutoff && attempts < 20) {
      attempts++;
      const dateStr = nextDate.toISOString().split("T")[0];
      const nearbyExists = existingDates.some(d => daysApart(d, nextDate) < 5);

      if (!nearbyExists) {
        await db.insert(billInstancesTable).values({
          userId,
          billerId: biller.id,
          amountDue: String(biller.typicalAmount),
          dueDate: dateStr,
          status: nextDate < today ? "overdue" : "unpaid",
        });
        created.push({ biller: biller.name, dueDate: dateStr });
        existingDates.push(new Date(dateStr));
      }

      nextDate = advanceDate(nextDate, biller.recurrence);
    }

    if (attempts === 0 || existingBills.length > 0 && created.filter(c => c.biller === biller.name).length === 0) {
      skipped.push(biller.name);
    }
  }

  res.json({ created, count: created.length, skipped });
});

export default router;
