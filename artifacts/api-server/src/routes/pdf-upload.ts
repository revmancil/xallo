import { Router, type IRouter, type Request, type Response, type NextFunction } from "express";
import multer from "multer";
// Import from lib path to avoid pdf-parse v1's test init code at startup
import pdfParse from "pdf-parse/lib/pdf-parse.js";
import { logSecurityEvent } from "../lib/security-logger";

const router: IRouter = Router();

const DEMO_USER_ID = "demo";
function getUserId(req: any): string {
  if (req.isAuthenticated()) return req.user.id;
  return DEMO_USER_ID;
}

const upload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: 10 * 1024 * 1024 },
  fileFilter: (_req, file, cb) => {
    if (file.mimetype === "application/pdf") {
      cb(null, true);
    } else {
      cb(new Error("Only PDF files are accepted."));
    }
  },
});

function extractBillData(text: string): { amountDue: number | null; dueDate: string | null; billerHint: string | null } {
  const normalized = text.replace(/\s+/g, " ").toLowerCase();

  const amountPatterns = [
    /(?:amount\s+due|total\s+due|balance\s+due|payment\s+due|total\s+amount|please\s+pay)[:\s]*\$?\s*([0-9,]+\.?[0-9]{0,2})/i,
    /(?:minimum\s+payment|amount\s+owed)[:\s]*\$?\s*([0-9,]+\.?[0-9]{0,2})/i,
    /\$\s*([0-9,]+\.[0-9]{2})\s*(?:due|owed|payable)/i,
  ];

  let amountDue: number | null = null;
  for (const pattern of amountPatterns) {
    const m = text.match(pattern);
    if (m) {
      const val = parseFloat(m[1].replace(/,/g, ""));
      if (!isNaN(val) && val > 0 && val < 100000) {
        amountDue = Math.round(val * 100) / 100;
        break;
      }
    }
  }

  const datePatterns = [
    /(?:due\s+date|payment\s+due|due\s+by|pay\s+by)[:\s]*([A-Za-z]+\.?\s+[0-9]{1,2},?\s+[0-9]{4})/i,
    /(?:due\s+date|payment\s+due|due\s+by)[:\s]*([0-9]{1,2}[\/\-][0-9]{1,2}[\/\-][0-9]{2,4})/i,
    /(?:due\s+date|billing\s+date)[:\s]*([0-9]{4}-[0-9]{2}-[0-9]{2})/i,
  ];

  let dueDate: string | null = null;
  for (const pattern of datePatterns) {
    const m = text.match(pattern);
    if (m) {
      const parsed = new Date(m[1]);
      if (!isNaN(parsed.getTime())) {
        dueDate = parsed.toISOString().split("T")[0];
        break;
      }
      dueDate = m[1].trim();
      break;
    }
  }

  const billerPatterns = [
    /(?:from|biller|company|utility)[:\s]+([A-Z][A-Za-z\s]+)/,
    /^([A-Z][A-Za-z\s]+(?:Inc|LLC|Corp|Electric|Gas|Water|Energy|Telecom|Communications)?\.?)\n/m,
  ];

  let billerHint: string | null = null;
  for (const pattern of billerPatterns) {
    const m = text.match(pattern);
    if (m) {
      billerHint = m[1].trim().substring(0, 50);
      break;
    }
  }

  return { amountDue, dueDate, billerHint };
}

// Wrap multer so its errors are caught as JSON instead of Express HTML pages
function uploadMiddleware(req: Request, res: Response, next: NextFunction) {
  upload.single("file")(req, res, (err) => {
    if (err) {
      const msg = err instanceof multer.MulterError
        ? `Upload error: ${err.message}`
        : err.message || "Failed to receive the uploaded file. The file may be too large or the upload was interrupted.";
      res.status(400).json({ error: msg });
      return;
    }
    next();
  });
}

router.post("/pdf/parse", uploadMiddleware, async (req: any, res) => {
  const userId = getUserId(req);

  if (!req.file) {
    res.status(400).json({ error: "No PDF file uploaded." });
    return;
  }

  try {
    const data = await pdfParse(req.file.buffer);
    const { amountDue, dueDate, billerHint } = extractBillData(data.text);

    await logSecurityEvent(req, userId, "pdf_bill_parsed", {
      fileName: req.file.originalname,
      pages: data.numpages,
      foundAmount: amountDue,
      foundDate: dueDate,
    });

    res.json({
      amountDue,
      dueDate,
      billerHint,
      pages: data.numpages,
      confidence: amountDue !== null && dueDate !== null ? "high" : amountDue !== null || dueDate !== null ? "partial" : "low",
      rawTextPreview: data.text.substring(0, 800).trim(),
    });
  } catch (err: any) {
    res.status(500).json({ error: "Failed to parse PDF. Make sure it is a text-based PDF (not a scanned image)." });
  }
});

export default router;
