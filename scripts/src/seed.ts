import { db, billersTable, billInstancesTable, incomeEntriesTable, bankAccountsTable } from "@workspace/db";
import { eq } from "drizzle-orm";

const DEMO_USER_ID = "demo";

async function seed() {
  console.log("Seeding demo data...");

  // Clear existing demo data
  await db.delete(billInstancesTable).where(eq(billInstancesTable.userId, DEMO_USER_ID));
  await db.delete(billersTable).where(eq(billersTable.userId, DEMO_USER_ID));
  await db.delete(incomeEntriesTable).where(eq(incomeEntriesTable.userId, DEMO_USER_ID));
  await db.delete(bankAccountsTable).where(eq(bankAccountsTable.userId, DEMO_USER_ID));

  // Create bank accounts
  await db.insert(bankAccountsTable).values([
    { userId: DEMO_USER_ID, name: "Checking Account", balance: "3842.50", institution: "Chase" },
    { userId: DEMO_USER_ID, name: "Savings Account", balance: "12500.00", institution: "Chase" },
  ]);

  // Create billers
  const billers = await db.insert(billersTable).values([
    { userId: DEMO_USER_ID, name: "Netflix", category: "Entertainment", typicalAmount: "15.49", dueDayOfMonth: 5, recurrence: "monthly", color: "#E50914", icon: "tv" },
    { userId: DEMO_USER_ID, name: "Spotify", category: "Entertainment", typicalAmount: "9.99", dueDayOfMonth: 8, recurrence: "monthly", color: "#1DB954", icon: "music" },
    { userId: DEMO_USER_ID, name: "Electric Bill", category: "Utilities", typicalAmount: "125.00", dueDayOfMonth: 15, recurrence: "monthly", color: "#F59E0B", icon: "zap" },
    { userId: DEMO_USER_ID, name: "Internet", category: "Utilities", typicalAmount: "79.99", dueDayOfMonth: 20, recurrence: "monthly", color: "#3B82F6", icon: "wifi" },
    { userId: DEMO_USER_ID, name: "Rent", category: "Housing", typicalAmount: "1500.00", dueDayOfMonth: 1, recurrence: "monthly", color: "#8B5CF6", icon: "home" },
    { userId: DEMO_USER_ID, name: "Car Insurance", category: "Insurance", typicalAmount: "185.00", dueDayOfMonth: 10, recurrence: "monthly", color: "#EC4899", icon: "car" },
    { userId: DEMO_USER_ID, name: "Gym Membership", category: "Health", typicalAmount: "45.00", dueDayOfMonth: 12, recurrence: "monthly", color: "#10B981", icon: "activity" },
    { userId: DEMO_USER_ID, name: "Phone Bill", category: "Utilities", typicalAmount: "65.00", dueDayOfMonth: 22, recurrence: "monthly", color: "#6366F1", icon: "smartphone" },
    { userId: DEMO_USER_ID, name: "Hulu", category: "Entertainment", typicalAmount: "17.99", dueDayOfMonth: 18, recurrence: "monthly", color: "#1CE783", icon: "tv" },
    { userId: DEMO_USER_ID, name: "Amazon Prime", category: "Shopping", typicalAmount: "14.99", dueDayOfMonth: 25, recurrence: "monthly", color: "#FF9900", icon: "package" },
  ]).returning();

  // Create bill instances for current month and surrounding months
  const today = new Date();
  const currentYear = today.getFullYear();
  const currentMonth = today.getMonth() + 1;

  const instances = [];

  for (const biller of billers) {
    const dueDayOfMonth = biller.dueDayOfMonth ?? 15;

    // Last month (mostly paid)
    const lastMonthDate = new Date(currentYear, currentMonth - 2, dueDayOfMonth);
    const lastMonthStr = lastMonthDate.toISOString().split("T")[0];
    instances.push({
      billerId: biller.id,
      userId: DEMO_USER_ID,
      amountDue: biller.typicalAmount ?? "50.00",
      dueDate: lastMonthStr,
      status: "paid" as const,
      paidAt: lastMonthDate,
    });

    // Current month - mix of statuses based on day relative to today
    const thisMonthDate = new Date(currentYear, currentMonth - 1, dueDayOfMonth);
    const thisMonthStr = thisMonthDate.toISOString().split("T")[0];
    let status: "paid" | "unpaid" | "scheduled" | "overdue";

    if (thisMonthDate < today) {
      // Past due dates: some paid, some overdue
      status = dueDayOfMonth % 3 === 0 ? "overdue" : "paid";
    } else if (thisMonthDate.getTime() - today.getTime() < 7 * 24 * 60 * 60 * 1000) {
      // Due within 7 days
      status = "scheduled";
    } else {
      status = "unpaid";
    }

    instances.push({
      billerId: biller.id,
      userId: DEMO_USER_ID,
      amountDue: biller.typicalAmount ?? "50.00",
      dueDate: thisMonthStr,
      status,
      paidAt: status === "paid" ? thisMonthDate : null,
    });

    // Next month (all unpaid/scheduled)
    const nextMonthDate = new Date(currentYear, currentMonth, dueDayOfMonth);
    const nextMonthStr = nextMonthDate.toISOString().split("T")[0];
    instances.push({
      billerId: biller.id,
      userId: DEMO_USER_ID,
      amountDue: biller.typicalAmount ?? "50.00",
      dueDate: nextMonthStr,
      status: "unpaid" as const,
    });
  }

  await db.insert(billInstancesTable).values(instances as any[]);

  // Create income entries
  // Find next few paydays (biweekly)
  const nextPayday1 = new Date(today);
  const dayOfWeek = nextPayday1.getDay();
  const daysUntilFriday = (5 - dayOfWeek + 7) % 7 || 7;
  nextPayday1.setDate(nextPayday1.getDate() + daysUntilFriday);

  const nextPayday2 = new Date(nextPayday1);
  nextPayday2.setDate(nextPayday2.getDate() + 14);

  const lastPayday = new Date(nextPayday1);
  lastPayday.setDate(lastPayday.getDate() - 14);

  await db.insert(incomeEntriesTable).values([
    { userId: DEMO_USER_ID, label: "Main Job", amount: "2800.00", payDate: lastPayday.toISOString().split("T")[0], recurrence: "biweekly" },
    { userId: DEMO_USER_ID, label: "Main Job", amount: "2800.00", payDate: nextPayday1.toISOString().split("T")[0], recurrence: "biweekly" },
    { userId: DEMO_USER_ID, label: "Main Job", amount: "2800.00", payDate: nextPayday2.toISOString().split("T")[0], recurrence: "biweekly" },
    { userId: DEMO_USER_ID, label: "Freelance", amount: "500.00", payDate: new Date(currentYear, currentMonth - 1, 28).toISOString().split("T")[0], recurrence: "monthly" },
  ]);

  console.log("✅ Demo data seeded successfully!");
  process.exit(0);
}

seed().catch(err => {
  console.error("Seed failed:", err);
  process.exit(1);
});
