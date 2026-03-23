import { Router, type IRouter } from "express";
import { db, bankAccountsTable } from "@workspace/db";
import { eq } from "drizzle-orm";
import { CreateAccountBody } from "@workspace/api-zod";

const router: IRouter = Router();

const DEMO_USER_ID = "demo";

function getUserId(req: any): string {
  if (req.isAuthenticated()) return req.user.id;
  return DEMO_USER_ID;
}

router.get("/accounts", async (req, res) => {
  const userId = getUserId(req);
  const accounts = await db.select().from(bankAccountsTable).where(eq(bankAccountsTable.userId, userId));
  res.json(accounts);
});

router.post("/accounts", async (req, res) => {
  const userId = getUserId(req);
  const parsed = CreateAccountBody.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: "Invalid request body" });
    return;
  }
  const [account] = await db
    .insert(bankAccountsTable)
    .values({ ...parsed.data, userId })
    .returning();
  res.status(201).json(account);
});

export default router;
