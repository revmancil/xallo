import { Router, type IRouter } from "express";
import { db, billInstancesTable, billersTable, bankAccountsTable } from "@workspace/db";
import { eq, and, lte, gte, sql } from "drizzle-orm";

const router: IRouter = Router();

const DEMO_USER_ID = "demo";

function getUserId(req: any): string {
  if (req.isAuthenticated()) return req.user.id;
  return DEMO_USER_ID;
}

router.get("/dashboard", async (req, res) => {
  const userId = getUserId(req);
  const today = new Date();
  const thirtyDaysLater = new Date();
  thirtyDaysLater.setDate(today.getDate() + 30);

  const todayStr = today.toISOString().split("T")[0];
  const thirtyDaysStr = thirtyDaysLater.toISOString().split("T")[0];

  const upcomingBills = await db
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
    .where(
      and(
        eq(billInstancesTable.userId, userId),
        gte(billInstancesTable.dueDate, todayStr),
        lte(billInstancesTable.dueDate, thirtyDaysStr)
      )
    );

  const accounts = await db.select().from(bankAccountsTable).where(eq(bankAccountsTable.userId, userId));
  const totalBalance = accounts.reduce((sum, a) => sum + parseFloat(a.balance), 0);

  const totalBillsDue = upcomingBills
    .filter(b => b.status !== "paid")
    .reduce((sum, b) => sum + parseFloat(b.amountDue), 0);

  const overdueCount = await db
    .select({ count: sql<number>`count(*)` })
    .from(billInstancesTable)
    .where(
      and(
        eq(billInstancesTable.userId, userId),
        eq(billInstancesTable.status, "overdue")
      )
    );

  res.json({
    totalBillsDue30Days: totalBillsDue,
    totalBalance,
    safetyGap: totalBalance - totalBillsDue,
    billsDueCount: upcomingBills.filter(b => b.status !== "paid").length,
    overdueCount: Number(overdueCount[0]?.count ?? 0),
    upcomingBills,
  });
});

export default router;
