import express from "express";
import { db } from "@workspace/db";
import { billInstancesTable, billersTable, bankAccountsTable, creditCardsTable, plaidItemsTable } from "@workspace/db/schema";
import { eq, and, desc } from "drizzle-orm";
import { Configuration, PlaidApi, PlaidEnvironments } from "plaid";

function getUserId(req: any): string {
  if (req.isAuthenticated?.()) return req.user.id;
  return "demo";
}

function makePlaidClient(): PlaidApi | null {
  const clientId = process.env.PLAID_CLIENT_ID;
  const secret = process.env.PLAID_SECRET;
  const env = (process.env.PLAID_ENV as keyof typeof PlaidEnvironments) || "sandbox";
  if (!clientId || !secret) return null;
  const config = new Configuration({
    basePath: PlaidEnvironments[env],
    baseOptions: { headers: { "PLAID-CLIENT-ID": clientId, "PLAID-SECRET": secret } },
  });
  return new PlaidApi(config);
}

const router = express.Router();

// ─── GET /api/transactions ───────────────────────────────────────────────────
// Aggregate transactions from:
//  1. Plaid (live bank/CC transactions, if connected)
//  2. Paid bill_instances (manual or Stripe-paid bills)
// Query params: startDate, endDate, search, accountId, accountType, source
router.get("/transactions", async (req, res) => {
  const userId = getUserId(req);
  const {
    startDate,
    endDate,
    search = "",
    source = "all",   // "all" | "plaid" | "bills"
  } = req.query as Record<string, string>;

  const now = new Date();
  const defaultEnd = now.toISOString().split("T")[0];
  const defaultStart = new Date(now.getTime() - 90 * 24 * 60 * 60 * 1000)
    .toISOString()
    .split("T")[0];
  const rangeStart = startDate || defaultStart;
  const rangeEnd = endDate || defaultEnd;

  const transactions: any[] = [];

  // ── 1. Paid bill instances ────────────────────────────────────────────────
  if (source === "all" || source === "bills") {
    const paid = await db
      .select({
        id: billInstancesTable.id,
        billerId: billInstancesTable.billerId,
        amountDue: billInstancesTable.amountDue,
        dueDate: billInstancesTable.dueDate,
        paidAt: billInstancesTable.paidAt,
        confirmationNumber: billInstancesTable.confirmationNumber,
        billerName: billersTable.name,
        billerCategory: billersTable.category,
      })
      .from(billInstancesTable)
      .leftJoin(billersTable, eq(billInstancesTable.billerId, billersTable.id))
      .where(
        and(
          eq(billInstancesTable.userId, userId),
          eq(billInstancesTable.status, "paid")
        )
      )
      .orderBy(desc(billInstancesTable.paidAt));

    for (const row of paid) {
      const txDate = row.paidAt
        ? row.paidAt.toISOString().split("T")[0]
        : row.dueDate;
      if (txDate < rangeStart || txDate > rangeEnd) continue;

      const name = row.billerName || "Bill Payment";
      if (search && !name.toLowerCase().includes(search.toLowerCase())) continue;

      transactions.push({
        id: `bill-${row.id}`,
        source: "bill",
        date: txDate,
        name,
        category: row.billerCategory || "Bills",
        amount: -Math.abs(parseFloat(row.amountDue as string || "0")),
        accountName: "Bill Payment",
        accountType: "bill",
        confirmationNumber: row.confirmationNumber || null,
        pending: false,
      });
    }
  }

  // ── 2. Plaid transactions ─────────────────────────────────────────────────
  if (source === "all" || source === "plaid") {
    const plaid = makePlaidClient();
    if (plaid) {
      const items = await db
        .select()
        .from(plaidItemsTable)
        .where(eq(plaidItemsTable.userId, userId));

      for (const item of items) {
        try {
          const resp = await plaid.transactionsGet({
            access_token: item.accessToken,
            start_date: rangeStart,
            end_date: rangeEnd,
          });
          for (const tx of resp.data.transactions) {
            const name = tx.merchant_name || tx.name || "Transaction";
            if (search && !name.toLowerCase().includes(search.toLowerCase())) continue;
            transactions.push({
              id: `plaid-${tx.transaction_id}`,
              source: "plaid",
              date: tx.date,
              name,
              category: tx.personal_finance_category?.primary
                ? toTitleCase(tx.personal_finance_category.primary.replace(/_/g, " "))
                : (tx.category?.[0] || "Other"),
              amount: -tx.amount,          // Plaid: positive = debit, so negate
              accountName: tx.account_id,  // resolved below if possible
              accountType: "bank",
              pending: tx.pending,
              logo: tx.logo_url || null,
            });
          }

          // Resolve account names from Plaid account IDs
          const accountsResp = await plaid.accountsGet({ access_token: item.accessToken });
          const accountMap: Record<string, string> = {};
          for (const acc of accountsResp.data.accounts) {
            accountMap[acc.account_id] = acc.name + (acc.mask ? ` ••${acc.mask}` : "");
          }
          // Patch account names
          for (const tx of transactions) {
            if (tx.source === "plaid" && accountMap[tx.accountName]) {
              tx.accountName = accountMap[tx.accountName];
              tx.accountType = accountsResp.data.accounts.find(
                (a: any) => a.name + (a.mask ? ` ••${a.mask}` : "") === tx.accountName
              )?.subtype || "bank";
            }
          }
        } catch {
          // Skip failed items silently
        }
      }
    }
  }

  // Sort by date descending, then by id for stability
  transactions.sort((a, b) => {
    if (b.date !== a.date) return b.date.localeCompare(a.date);
    return a.id.localeCompare(b.id);
  });

  // Compute summary
  let totalDebits = 0;
  let totalCredits = 0;
  for (const tx of transactions) {
    if (tx.amount < 0) totalDebits += tx.amount;
    else totalCredits += tx.amount;
  }

  // Fetch accounts for filter panel
  const bankAccounts = await db
    .select()
    .from(bankAccountsTable)
    .where(eq(bankAccountsTable.userId, userId));

  const creditCards = await db
    .select()
    .from(creditCardsTable)
    .where(eq(creditCardsTable.userId, userId));

  res.json({
    transactions,
    summary: {
      totalSpent: Math.abs(totalDebits),
      totalIncome: totalCredits,
      net: totalCredits + totalDebits,
      count: transactions.length,
    },
    accounts: {
      bank: bankAccounts,
      creditCards,
    },
  });
});

function toTitleCase(str: string) {
  return str.replace(/\w\S*/g, (txt) => txt[0].toUpperCase() + txt.slice(1).toLowerCase());
}

export default router;
