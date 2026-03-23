import { Router, type IRouter } from "express";
import { db, billersTable } from "@workspace/db";
import { eq, and } from "drizzle-orm";
import { CreateBillerBody, UpdateBillerBody } from "@workspace/api-zod";

const router: IRouter = Router();

const DEMO_USER_ID = "demo";

function getUserId(req: any): string {
  if (req.isAuthenticated()) return req.user.id;
  return DEMO_USER_ID;
}

router.get("/billers", async (req, res) => {
  const userId = getUserId(req);
  const billers = await db.select().from(billersTable).where(eq(billersTable.userId, userId));
  res.json(billers);
});

router.post("/billers", async (req, res) => {
  const userId = getUserId(req);
  const parsed = CreateBillerBody.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: "Invalid request body" });
    return;
  }
  const [biller] = await db
    .insert(billersTable)
    .values({ ...parsed.data, userId })
    .returning();
  res.status(201).json(biller);
});

router.put("/billers/:billerId", async (req, res) => {
  const userId = getUserId(req);
  const billerId = parseInt(req.params.billerId);
  const parsed = UpdateBillerBody.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: "Invalid request body" });
    return;
  }
  const [biller] = await db
    .update(billersTable)
    .set(parsed.data)
    .where(and(eq(billersTable.id, billerId), eq(billersTable.userId, userId)))
    .returning();
  if (!biller) {
    res.status(404).json({ error: "Biller not found" });
    return;
  }
  res.json(biller);
});

router.delete("/billers/:billerId", async (req, res) => {
  const userId = getUserId(req);
  const billerId = parseInt(req.params.billerId);
  await db
    .delete(billersTable)
    .where(and(eq(billersTable.id, billerId), eq(billersTable.userId, userId)));
  res.json({ success: true });
});

export default router;
