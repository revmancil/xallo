import { Router, type IRouter } from "express";
import { db, bankAccountsTable } from "@workspace/db";
import { eq } from "drizzle-orm";

const router: IRouter = Router();

const DEMO_USER_ID = "demo";

function getUserId(req: any): string {
  if (req.isAuthenticated()) return req.user.id;
  return DEMO_USER_ID;
}

function parseCreateBody(body: any) {
  const { name, balance, institution } = body ?? {};
  if (typeof name !== "string" || name.trim() === "") {
    return { error: "name is required" };
  }
  if (balance == null || isNaN(Number(balance))) {
    return { error: "balance is required and must be a number" };
  }
  return {
    data: {
      name: name.trim(),
      balance: String(Number(balance)),
      institution: typeof institution === "string" && institution.trim() !== "" ? institution.trim() : null,
    },
  };
}

router.get("/accounts", async (req, res) => {
  const userId = getUserId(req);
  const accounts = await db.select().from(bankAccountsTable).where(eq(bankAccountsTable.userId, userId));
  res.json(accounts);
});

router.post("/accounts", async (req, res) => {
  const userId = getUserId(req);
  const parsed = parseCreateBody(req.body);
  if ("error" in parsed) {
    res.status(400).json({ error: parsed.error });
    return;
  }
  const [account] = await db
    .insert(bankAccountsTable)
    .values({ ...parsed.data, userId })
    .returning();
  res.status(201).json(account);
});

export default router;
