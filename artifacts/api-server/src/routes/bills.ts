import { Router, type IRouter } from "express";
import { db, billInstancesTable, billersTable } from "@workspace/db";
import { eq, and, sql } from "drizzle-orm";
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

export default router;
