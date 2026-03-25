import { Router, type IRouter } from "express";
import { getUncachableStripeClient, getStripePublishableKey } from "../stripeClient";
import { db, billInstancesTable, billersTable } from "@workspace/db";
import { eq, and } from "drizzle-orm";

const router: IRouter = Router();

const DEMO_USER_ID = "demo";
function getUserId(req: any): string {
  if (req.isAuthenticated()) return req.user.id;
  return DEMO_USER_ID;
}

// Return the publishable key so the frontend can load Stripe.js
router.get("/payments/config", async (_req, res) => {
  try {
    const publishableKey = await getStripePublishableKey();
    res.json({ publishableKey });
  } catch {
    res.status(503).json({ error: "Payment configuration unavailable." });
  }
});

// Create a PaymentIntent for a specific bill instance
router.post("/payments/create-intent", async (req: any, res) => {
  const userId = getUserId(req);
  const { billInstanceId } = req.body ?? {};

  if (!billInstanceId) {
    res.status(400).json({ error: "billInstanceId is required" });
    return;
  }

  // Fetch the bill + biller to get the amount and description
  const [bill] = await db
    .select({
      id: billInstancesTable.id,
      amountDue: billInstancesTable.amountDue,
      status: billInstancesTable.status,
      billerName: billersTable.name,
      billerCategory: billersTable.category,
    })
    .from(billInstancesTable)
    .innerJoin(billersTable, eq(billInstancesTable.billerId, billersTable.id))
    .where(
      and(
        eq(billInstancesTable.id, Number(billInstanceId)),
        eq(billInstancesTable.userId, userId)
      )
    );

  if (!bill) {
    res.status(404).json({ error: "Bill not found" });
    return;
  }

  if (bill.status === "paid") {
    res.status(400).json({ error: "This bill has already been paid." });
    return;
  }

  const amountCents = Math.round(Number(bill.amountDue) * 100);
  if (amountCents <= 0) {
    res.status(400).json({ error: "Invalid bill amount." });
    return;
  }

  try {
    const stripe = await getUncachableStripeClient();
    const intent = await stripe.paymentIntents.create({
      amount: amountCents,
      currency: "usd",
      description: `${bill.billerName} — bill payment`,
      metadata: {
        userId,
        billInstanceId: String(billInstanceId),
        billerName: bill.billerName,
        billerCategory: bill.billerCategory ?? "",
      },
      automatic_payment_methods: { enabled: true },
    });

    res.json({ clientSecret: intent.client_secret, amountCents, billerName: bill.billerName });
  } catch (err: any) {
    console.error("[payments] create-intent error:", err?.message);
    res.status(500).json({ error: "Failed to create payment. Please try again." });
  }
});

// Mark a bill as paid after successful payment (called from frontend after Stripe confirms)
router.post("/payments/confirm", async (req: any, res) => {
  const userId = getUserId(req);
  const { billInstanceId, paymentIntentId } = req.body ?? {};

  if (!billInstanceId || !paymentIntentId) {
    res.status(400).json({ error: "billInstanceId and paymentIntentId are required" });
    return;
  }

  // Verify the payment intent actually succeeded with Stripe
  try {
    const stripe = await getUncachableStripeClient();
    const intent = await stripe.paymentIntents.retrieve(paymentIntentId);
    if (intent.status !== "succeeded") {
      res.status(400).json({ error: `Payment not yet succeeded (status: ${intent.status})` });
      return;
    }
    // Verify metadata matches this user's bill
    if (
      intent.metadata?.userId !== userId ||
      intent.metadata?.billInstanceId !== String(billInstanceId)
    ) {
      res.status(403).json({ error: "Payment intent does not match this bill." });
      return;
    }
  } catch (err: any) {
    console.error("[payments] confirm error:", err?.message);
    res.status(500).json({ error: "Could not verify payment with Stripe." });
    return;
  }

  // Mark the bill as paid
  const [updated] = await db
    .update(billInstancesTable)
    .set({ status: "paid" })
    .where(
      and(
        eq(billInstancesTable.id, Number(billInstanceId)),
        eq(billInstancesTable.userId, userId)
      )
    )
    .returning();

  if (!updated) {
    res.status(404).json({ error: "Bill not found" });
    return;
  }

  res.json({ success: true, bill: updated });
});

export default router;
