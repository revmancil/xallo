import { Router, type IRouter } from "express";
import healthRouter from "./health";
import authRouter from "./auth";
import billersRouter from "./billers";
import billsRouter from "./bills";
import incomeRouter from "./income";
import accountsRouter from "./accounts";
import dashboardRouter from "./dashboard";
import plaidRouter from "./plaid";
import analyticsRouter from "./analytics";
import securityLogRouter from "./security-log";
import pdfUploadRouter from "./pdf-upload";
import budgetRouter from "./budget";
import gmailImportRouter from "./gmail-import";
import creditCardsRouter from "./credit-cards";
import paymentsRouter from "./payments";

const router: IRouter = Router();

router.use(healthRouter);
router.use(authRouter);
router.use(billersRouter);
router.use(billsRouter);
router.use(incomeRouter);
router.use(accountsRouter);
router.use(dashboardRouter);
router.use(plaidRouter);
router.use(analyticsRouter);
router.use(securityLogRouter);
router.use(pdfUploadRouter);
router.use(budgetRouter);
router.use(gmailImportRouter);
router.use(creditCardsRouter);
router.use(paymentsRouter);

export default router;
