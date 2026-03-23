import { Router, type IRouter } from "express";
import {
  Configuration,
  PlaidApi,
  PlaidEnvironments,
  Products,
  CountryCode,
} from "plaid";
import { db, bankAccountsTable, plaidItemsTable } from "@workspace/db";
import { eq, and } from "drizzle-orm";

const router: IRouter = Router();

const DEMO_USER_ID = "demo";

function getUserId(req: any): string {
  if (req.isAuthenticated()) return req.user.id;
  return DEMO_USER_ID;
}

function getPlaidClient() {
  const clientId = process.env.PLAID_CLIENT_ID;
  const secret = process.env.PLAID_SECRET;
  const env = (process.env.PLAID_ENV as keyof typeof PlaidEnvironments) || "sandbox";

  if (!clientId || !secret) return null;

  const config = new Configuration({
    basePath: PlaidEnvironments[env],
    baseOptions: {
      headers: {
        "PLAID-CLIENT-ID": clientId,
        "PLAID-SECRET": secret,
      },
    },
  });
  return new PlaidApi(config);
}

router.get("/plaid/status", (req, res) => {
  const configured = !!(process.env.PLAID_CLIENT_ID && process.env.PLAID_SECRET);
  res.json({
    configured,
    environment: process.env.PLAID_ENV || "sandbox",
  });
});

router.post("/plaid/create-link-token", async (req, res) => {
  const userId = getUserId(req);
  const plaid = getPlaidClient();
  if (!plaid) {
    res.status(503).json({ error: "Plaid not configured. Set PLAID_CLIENT_ID and PLAID_SECRET." });
    return;
  }

  try {
    const response = await plaid.linkTokenCreate({
      user: { client_user_id: userId },
      client_name: "PrismClone",
      products: [Products.Auth, Products.Transactions, Products.Liabilities],
      country_codes: [CountryCode.Us],
      language: "en",
    });
    res.json({ link_token: response.data.link_token });
  } catch (err: any) {
    console.error("Plaid link token error:", err?.response?.data || err);
    res.status(500).json({ error: "Failed to create Plaid link token." });
  }
});

router.post("/plaid/exchange-token", async (req, res) => {
  const userId = getUserId(req);
  const { public_token, metadata } = req.body;

  if (!public_token) {
    res.status(400).json({ error: "public_token is required" });
    return;
  }

  const plaid = getPlaidClient();
  if (!plaid) {
    res.status(503).json({ error: "Plaid not configured." });
    return;
  }

  try {
    const exchangeResponse = await plaid.itemPublicTokenExchange({ public_token });
    const { access_token, item_id } = exchangeResponse.data;

    await db.insert(plaidItemsTable).values({
      userId,
      accessToken: access_token,
      itemId: item_id,
      institutionId: metadata?.institution?.institution_id,
      institutionName: metadata?.institution?.name,
    });

    const accountsResponse = await plaid.accountsGet({ access_token });
    const plaidAccounts = accountsResponse.data.accounts;

    const created = [];
    for (const acct of plaidAccounts) {
      if (acct.type === "depository") {
        const [saved] = await db
          .insert(bankAccountsTable)
          .values({
            userId,
            name: acct.name,
            balance: String(acct.balances.current ?? acct.balances.available ?? 0),
            institution: metadata?.institution?.name || "Plaid",
          })
          .returning();
        created.push(saved);
      }
    }

    res.json({
      success: true,
      accountsImported: created.length,
      institutionName: metadata?.institution?.name,
    });
  } catch (err: any) {
    console.error("Plaid exchange error:", err?.response?.data || err);
    res.status(500).json({ error: "Failed to exchange Plaid token." });
  }
});

router.get("/plaid/liabilities", async (req, res) => {
  const userId = getUserId(req);
  const plaid = getPlaidClient();
  if (!plaid) {
    res.status(503).json({ error: "Plaid not configured." });
    return;
  }

  const items = await db
    .select()
    .from(plaidItemsTable)
    .where(eq(plaidItemsTable.userId, userId));

  if (items.length === 0) {
    res.json({ liabilities: [] });
    return;
  }

  const allLiabilities: any[] = [];
  for (const item of items) {
    try {
      const response = await plaid.liabilitiesGet({ access_token: item.accessToken });
      const { credit } = response.data.liabilities;
      if (credit) allLiabilities.push(...credit);
    } catch {
    }
  }

  res.json({ liabilities: allLiabilities });
});

router.get("/plaid/transactions", async (req, res) => {
  const userId = getUserId(req);
  const plaid = getPlaidClient();
  if (!plaid) {
    res.status(503).json({ error: "Plaid not configured." });
    return;
  }

  const items = await db
    .select()
    .from(plaidItemsTable)
    .where(eq(plaidItemsTable.userId, userId));

  if (items.length === 0) {
    res.json({ transactions: [], discovered: [] });
    return;
  }

  const endDate = new Date().toISOString().split("T")[0];
  const startDate = new Date(Date.now() - 90 * 24 * 60 * 60 * 1000).toISOString().split("T")[0];

  const allTransactions: any[] = [];
  for (const item of items) {
    try {
      const response = await plaid.transactionsGet({
        access_token: item.accessToken,
        start_date: startDate,
        end_date: endDate,
      });
      allTransactions.push(...response.data.transactions);
    } catch {
    }
  }

  const discovered = discoverRecurring(allTransactions);
  res.json({ transactions: allTransactions, discovered });
});

function discoverRecurring(transactions: any[]): any[] {
  const nameMap: Record<string, { dates: string[]; amounts: number[] }> = {};

  for (const tx of transactions) {
    const key = (tx.merchant_name || tx.name || "").toLowerCase().trim();
    if (!key) continue;
    if (!nameMap[key]) nameMap[key] = { dates: [], amounts: [] };
    nameMap[key].dates.push(tx.date);
    nameMap[key].amounts.push(Math.abs(tx.amount));
  }

  const discovered: any[] = [];
  for (const [name, { dates, amounts }] of Object.entries(nameMap)) {
    if (dates.length >= 2) {
      const avgAmount = amounts.reduce((a, b) => a + b, 0) / amounts.length;
      const variance = amounts.reduce((a, b) => a + Math.abs(b - avgAmount), 0) / amounts.length;
      if (variance / avgAmount < 0.1) {
        discovered.push({
          name,
          occurrences: dates.length,
          typicalAmount: Math.round(avgAmount * 100) / 100,
          lastSeen: dates.sort().at(-1),
        });
      }
    }
  }

  return discovered.sort((a, b) => b.occurrences - a.occurrences);
}

export default router;
