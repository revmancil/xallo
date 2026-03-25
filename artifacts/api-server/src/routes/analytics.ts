import { Router, type IRouter } from "express";
import { db, billInstancesTable, billersTable } from "@workspace/db";
import { eq, and, sql, gte, desc } from "drizzle-orm";

const router: IRouter = Router();

const DEMO_USER_ID = "demo";
function getUserId(req: any): string {
  if (req.isAuthenticated()) return req.user.id;
  return DEMO_USER_ID;
}

router.get("/analytics/monthly", async (req, res) => {
  const userId = getUserId(req);

  // Show 3 months back, current month, and 2 months ahead (6 total)
  const result = await db.execute(sql`
    SELECT 
      TO_CHAR(DATE_TRUNC('month', due_date::date), 'Mon YYYY') as month,
      DATE_TRUNC('month', due_date::date) as month_date,
      ROUND(SUM(amount_due::numeric), 2) as total,
      COUNT(*)::int as count,
      CASE 
        WHEN DATE_TRUNC('month', due_date::date) > DATE_TRUNC('month', CURRENT_DATE) THEN true
        ELSE false
      END as is_future
    FROM bill_instances
    WHERE user_id = ${userId}
      AND due_date >= DATE_TRUNC('month', CURRENT_DATE - INTERVAL '3 months')
      AND due_date <  DATE_TRUNC('month', CURRENT_DATE + INTERVAL '3 months')
    GROUP BY DATE_TRUNC('month', due_date::date)
    ORDER BY month_date ASC
  `);

  res.json(result.rows);
});

router.get("/analytics/subscription-changes", async (req, res) => {
  const userId = getUserId(req);

  const result = await db.execute(sql`
    WITH monthly AS (
      SELECT 
        bi.biller_id,
        b.name as biller_name,
        b.icon,
        b.category,
        DATE_TRUNC('month', bi.due_date::date) as month,
        ROUND(AVG(bi.amount_due::numeric), 2) as avg_amount
      FROM bill_instances bi
      JOIN billers b ON bi.biller_id = b.id
      WHERE bi.user_id = ${userId}
        AND bi.due_date >= (CURRENT_DATE - INTERVAL '3 months')::date
      GROUP BY bi.biller_id, b.name, b.icon, b.category, DATE_TRUNC('month', bi.due_date::date)
    ),
    paired AS (
      SELECT
        curr.biller_id,
        curr.biller_name,
        curr.icon,
        curr.category,
        curr.avg_amount as current_amount,
        prev.avg_amount as previous_amount,
        ROUND(((curr.avg_amount - prev.avg_amount) / NULLIF(prev.avg_amount, 0)) * 100, 1) as change_pct
      FROM monthly curr
      JOIN monthly prev ON curr.biller_id = prev.biller_id
        AND curr.month > prev.month
        AND prev.month = (
          SELECT MAX(m2.month) FROM monthly m2
          WHERE m2.biller_id = curr.biller_id AND m2.month < curr.month
        )
      WHERE curr.month = DATE_TRUNC('month', CURRENT_DATE)
    )
    SELECT * FROM paired ORDER BY ABS(change_pct) DESC
  `);

  res.json(result.rows);
});

router.get("/analytics/summary", async (req, res) => {
  const userId = getUserId(req);

  const [bills, topBillers] = await Promise.all([
    db.execute(sql`
      SELECT 
        COUNT(*)::int as total_bills,
        COUNT(CASE WHEN status = 'paid' THEN 1 END)::int as paid_count,
        ROUND(SUM(amount_due::numeric), 2) as total_amount,
        ROUND(SUM(CASE WHEN status = 'paid' THEN amount_due::numeric ELSE 0 END), 2) as paid_amount
      FROM bill_instances
      WHERE user_id = ${userId}
        AND due_date >= DATE_TRUNC('month', CURRENT_DATE)
        AND due_date < DATE_TRUNC('month', CURRENT_DATE) + INTERVAL '1 month'
    `),
    db.execute(sql`
      SELECT 
        b.name,
        b.category,
        b.icon,
        ROUND(SUM(bi.amount_due::numeric), 2) as total_spent,
        COUNT(*)::int as occurrences
      FROM bill_instances bi
      JOIN billers b ON bi.biller_id = b.id
      WHERE bi.user_id = ${userId}
        AND bi.due_date >= (CURRENT_DATE - INTERVAL '6 months')::date
      GROUP BY b.id, b.name, b.category, b.icon
      ORDER BY total_spent DESC
      LIMIT 5
    `),
  ]);

  res.json({
    thisMonth: bills.rows[0] || {},
    topBillers: topBillers.rows,
  });
});

export default router;
