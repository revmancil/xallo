import { Router, type IRouter } from "express";
import { db, billersTable } from "@workspace/db";
import { eq, and } from "drizzle-orm";

const router: IRouter = Router();

const DEMO_USER_ID = "demo";

function getUserId(req: any): string {
  if (req.isAuthenticated()) return req.user.id;
  return DEMO_USER_ID;
}

function parseCreateBody(body: any) {
  const { name, category, recurrence, typicalAmount, dueDayOfMonth, websiteUrl, color, icon } = body ?? {};
  if (typeof name !== "string" || name.trim() === "") {
    return { error: "name is required" };
  }
  if (typeof category !== "string" || category.trim() === "") {
    return { error: "category is required" };
  }
  const validRecurrences = ["monthly", "biweekly", "weekly", "one-time"];
  const resolvedRecurrence = validRecurrences.includes(recurrence) ? recurrence : "monthly";
  return {
    data: {
      name: name.trim(),
      category: category.trim(),
      recurrence: resolvedRecurrence,
      typicalAmount: typicalAmount != null ? Number(typicalAmount) : null,
      dueDayOfMonth: dueDayOfMonth != null ? Number(dueDayOfMonth) : null,
      websiteUrl: typeof websiteUrl === "string" && websiteUrl.trim() !== "" ? websiteUrl.trim() : null,
      color: typeof color === "string" && color.trim() !== "" ? color.trim() : null,
      icon: typeof icon === "string" && icon.trim() !== "" ? icon.trim() : null,
    },
  };
}

function parseUpdateBody(body: any) {
  const { name, category, recurrence, typicalAmount, dueDayOfMonth, websiteUrl, color, icon } = body ?? {};
  const data: Record<string, any> = {};
  if (name !== undefined) data.name = String(name).trim();
  if (category !== undefined) data.category = String(category).trim();
  if (recurrence !== undefined) data.recurrence = recurrence;
  if (typicalAmount !== undefined) data.typicalAmount = typicalAmount != null ? Number(typicalAmount) : null;
  if (dueDayOfMonth !== undefined) data.dueDayOfMonth = dueDayOfMonth != null ? Number(dueDayOfMonth) : null;
  if (websiteUrl !== undefined) data.websiteUrl = typeof websiteUrl === "string" && websiteUrl.trim() !== "" ? websiteUrl.trim() : null;
  if (color !== undefined) data.color = typeof color === "string" && color.trim() !== "" ? color.trim() : null;
  if (icon !== undefined) data.icon = typeof icon === "string" && icon.trim() !== "" ? icon.trim() : null;
  return { data };
}

router.get("/billers", async (req, res) => {
  const userId = getUserId(req);
  const billers = await db.select().from(billersTable).where(eq(billersTable.userId, userId));
  res.json(billers);
});

router.post("/billers", async (req, res) => {
  const userId = getUserId(req);
  console.log("[billers POST] content-type:", req.headers["content-type"]);
  console.log("[billers POST] body:", JSON.stringify(req.body));
  const parsed = parseCreateBody(req.body);
  if ("error" in parsed) {
    console.log("[billers POST] validation error:", parsed.error);
    res.status(400).json({ error: parsed.error });
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
  const { data } = parseUpdateBody(req.body);
  if (Object.keys(data).length === 0) {
    res.status(400).json({ error: "No fields to update" });
    return;
  }
  const [biller] = await db
    .update(billersTable)
    .set(data)
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
