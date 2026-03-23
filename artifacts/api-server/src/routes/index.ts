import { Router, type IRouter } from "express";
import healthRouter from "./health";
import authRouter from "./auth";
import billersRouter from "./billers";
import billsRouter from "./bills";
import incomeRouter from "./income";
import accountsRouter from "./accounts";
import dashboardRouter from "./dashboard";

const router: IRouter = Router();

router.use(healthRouter);
router.use(authRouter);
router.use(billersRouter);
router.use(billsRouter);
router.use(incomeRouter);
router.use(accountsRouter);
router.use(dashboardRouter);

export default router;
