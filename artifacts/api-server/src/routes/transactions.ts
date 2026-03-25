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

// ─── GET /api/transactions ────────────────────────────────────────────────────
// Aggregates: Plaid bank/CC transactions + paid bill instances
// Query params: startDate, endDate, search, source, accountId
router.get("/transactions", async (req, res) => {
  const userId = getUserId(req);
  const {
    startDate,
    endDate,
    search = "",
    source = "all",
    accountId = "",   // Plaid account_id to filter by
  } = req.query as Record<string, string>;

  const now = new Date();
  const defaultEnd = now.toISOString().split("T")[0];
  const defaultStart = new Date(now.getTime() - 90 * 24 * 60 * 60 * 1000)
    .toISOString().split("T")[0];
  const rangeStart = startDate || defaultStart;
  const rangeEnd = endDate || defaultEnd;

  const transactions: any[] = [];
  const plaidAccounts: any[] = [];   // all connected accounts with current balances

  // ── 1. Plaid transactions + account balances ───────────────────────────────
  if (source === "all" || source === "plaid") {
    const plaid = makePlaidClient();
    if (plaid) {
      const items = await db
        .select()
        .from(plaidItemsTable)
        .where(eq(plaidItemsTable.userId, userId));

      for (const item of items) {
        try {
          // Fetch accounts first (for name map + balances)
          const acctResp = await plaid.accountsGet({ access_token: item.accessToken });
          const accountMap: Record<string, { displayName: string; subtype: string; balance: number | null }> = {};
          for (const acc of acctResp.data.accounts) {
            const displayName = acc.name + (acc.mask ? ` ••${acc.mask}` : "");
            const balance = acc.balances.current ?? acc.balances.available ?? null;
            accountMap[acc.account_id] = { displayName, subtype: acc.subtype || "bank", balance };
            plaidAccounts.push({
              id: acc.account_id,
              name: displayName,
              officialName: acc.official_name || null,
              subtype: acc.subtype || "bank",
              type: acc.type,
              balance,
              institutionName: item.institutionName || "Bank",
            });
          }

          // Fetch transactions
          const txResp = await plaid.transactionsGet({
            access_token: item.accessToken,
            start_date: rangeStart,
            end_date: rangeEnd,
          });

          for (const tx of txResp.data.transactions) {
            // Account-level filter
            if (accountId && tx.account_id !== accountId) continue;

            const name = tx.merchant_name || tx.name || "Transaction";
            if (search && !name.toLowerCase().includes(search.toLowerCase())) continue;

            const acctInfo = accountMap[tx.account_id];
            transactions.push({
              id: `plaid-${tx.transaction_id}`,
              source: "plaid",
              date: tx.date,
              name,
              category: tx.personal_finance_category?.primary
                ? toTitleCase(tx.personal_finance_category.primary.replace(/_/g, " "))
                : (tx.category?.[0] || "Other"),
              amount: -tx.amount,   // Plaid: positive = debit; negate so debits are negative
              plaidAccountId: tx.account_id,
              accountName: acctInfo?.displayName ?? tx.account_id,
              accountType: acctInfo?.subtype ?? "bank",
              pending: tx.pending,
              logo: tx.logo_url || null,
            });
          }
        } catch {
          // Skip failed items silently
        }
      }
    }
  }

  // ── 2. Paid bill instances ─────────────────────────────────────────────────
  if ((source === "all" || source === "bills") && !accountId) {
    const paid = await db
      .select({
        id: billInstancesTable.id,
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
        plaidAccountId: null,
        accountName: "Bill Payment",
        accountType: "bill",
        confirmationNumber: row.confirmationNumber || null,
        pending: false,
      });
    }
  }

  // Sort newest → oldest
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

  // Fetch manual bank accounts & credit cards for filter panel
  const manualBankAccounts = await db
    .select()
    .from(bankAccountsTable)
    .where(eq(bankAccountsTable.userId, userId));

  const creditCards = await db
    .select()
    .from(creditCardsTable)
    .where(eq(creditCardsTable.userId, userId));

  // If filtering by account, attach current balance for running balance calc
  let filterAccountBalance: number | null = null;
  if (accountId) {
    const acct = plaidAccounts.find(a => a.id === accountId);
    filterAccountBalance = acct?.balance ?? null;
  }

  res.json({
    transactions,
    filterAccountBalance,
    summary: {
      totalSpent: Math.abs(totalDebits),
      totalIncome: totalCredits,
      net: totalCredits + totalDebits,
      count: transactions.length,
    },
    accounts: {
      plaid: plaidAccounts,
      bank: manualBankAccounts,
      creditCards,
    },
  });
});

function toTitleCase(str: string) {
  return str.replace(/\w\S*/g, txt => txt[0].toUpperCase() + txt.slice(1).toLowerCase());
}

export default router;
