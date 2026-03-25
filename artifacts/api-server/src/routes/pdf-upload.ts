import { Router, type IRouter, type Request, type Response, type NextFunction } from "express";
import multer from "multer";
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

// All month names for parsing
const MONTH_NAMES = "(?:Jan(?:uary)?|Feb(?:ruary)?|Mar(?:ch)?|Apr(?:il)?|May|Jun(?:e)?|Jul(?:y)?|Aug(?:ust)?|Sep(?:tember)?|Oct(?:ober)?|Nov(?:ember)?|Dec(?:ember)?)";

// Try to parse a date string into YYYY-MM-DD, return null if invalid
function parseDate(raw: string): string | null {
  const s = raw.trim();
  // Already ISO
  if (/^\d{4}-\d{2}-\d{2}$/.test(s)) {
    const d = new Date(s);
    return isNaN(d.getTime()) ? null : s;
  }
  // Try native parse (handles "March 31, 2026", "Mar 31 2026", "03/31/2026", etc.)
  const d = new Date(s);
  if (!isNaN(d.getTime()) && d.getFullYear() > 2000 && d.getFullYear() < 2100) {
    return d.toISOString().split("T")[0];
  }
  // DD/MM/YYYY — try flipping month/day if native failed
  const dmyMatch = s.match(/^(\d{1,2})[\/\-\.](\d{1,2})[\/\-\.](\d{2,4})$/);
  if (dmyMatch) {
    const [, d1, d2, y] = dmyMatch;
    const year = y.length === 2 ? `20${y}` : y;
    const flipped = new Date(`${year}-${d2.padStart(2, "0")}-${d1.padStart(2, "0")}`);
    if (!isNaN(flipped.getTime())) return flipped.toISOString().split("T")[0];
  }
  return null;
}

// Extract any date-like string from the text surrounding a keyword match
// Looks within a window of characters after the keyword
function findDateNear(text: string, keywordPattern: RegExp, windowChars = 60): string | null {
  const dateFormats = [
    // ISO: 2026-03-31
    /\d{4}-\d{2}-\d{2}/,
    // Month DD, YYYY or Month DD YYYY
    new RegExp(`${MONTH_NAMES}\\s+\\d{1,2},?\\s+\\d{4}`, "i"),
    // DD Month YYYY
    new RegExp(`\\d{1,2}\\s+${MONTH_NAMES}\\s+\\d{4}`, "i"),
    // MM/DD/YYYY or DD/MM/YYYY or DD-MM-YYYY
    /\d{1,2}[\/\-\.]\d{1,2}[\/\-\.]\d{2,4}/,
    // MM/DD/YY
    /\d{1,2}\/\d{1,2}\/\d{2}/,
  ];

  let match: RegExpExecArray | null;
  const kRe = new RegExp(keywordPattern.source, keywordPattern.flags.includes("g") ? keywordPattern.flags : keywordPattern.flags + "g");
  while ((match = kRe.exec(text)) !== null) {
    const window = text.substring(match.index + match[0].length, match.index + match[0].length + windowChars);
    for (const fmt of dateFormats) {
      const dm = window.match(fmt);
      if (dm) {
        const parsed = parseDate(dm[0]);
        if (parsed) return parsed;
      }
    }
  }
  return null;
}

function extractBillData(text: string): {
  amountDue: number | null;
  dueDate: string | null;
  billerHint: string | null;
} {
  // Log first 1500 chars for debugging
  console.log("[pdf-scan] raw text preview:", text.substring(0, 1500));

  // ── Amount extraction ─────────────────────────────────────────────────────
  const amountPatterns = [
    /(?:amount\s+due|total\s+due|balance\s+due|payment\s+due|total\s+amount|please\s+pay|pay\s+this\s+amount|amt\s+due)[:\s]*\$?\s*([0-9,]+\.?[0-9]{0,2})/i,
    /(?:minimum\s+payment|amount\s+owed|current\s+charges|new\s+charges)[:\s]*\$?\s*([0-9,]+\.?[0-9]{0,2})/i,
    /(?:total)[:\s]*\$?\s*([0-9,]+\.[0-9]{2})/i,
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

  // ── Date extraction ───────────────────────────────────────────────────────
  // Strategy: try labeled patterns first (normalize spaces/newlines to single space),
  // then try proximity search in the raw text.

  const normalized = text.replace(/\r\n/g, "\n").replace(/[ \t]+/g, " ");

  // Labeled patterns — label immediately followed by date (allow label:\ndate)
  const labeledDatePatterns: RegExp[] = [
    // "Due Date: March 31, 2026"
    new RegExp(`(?:due\\s+date|payment\\s+due\\s+date|bill\\s+due\\s+date)[:\\s]*([\\s\\S]{0,4}${MONTH_NAMES}\\s+\\d{1,2},?\\s+\\d{4})`, "i"),
    // "Due Date: 03/31/2026"
    /(?:due\s+date|payment\s+due\s+date|bill\s+due\s+date)[:\s]*([\s\S]{0,4}\d{1,2}[\/\-\.]\d{1,2}[\/\-\.]\d{2,4})/i,
    // "Due Date: 2026-03-31"
    /(?:due\s+date|payment\s+due\s+date)[:\s]*([\s\S]{0,4}\d{4}-\d{2}-\d{2})/i,
    // "Due By / Pay By / Due On / Payment Due"
    new RegExp(`(?:due\\s+by|pay\\s+by|due\\s+on|payment\\s+due|please\\s+pay\\s+by|payable\\s+by)[:\\s]*([\\s\\S]{0,4}${MONTH_NAMES}\\s+\\d{1,2},?\\s+\\d{4})`, "i"),
    /(?:due\s+by|pay\s+by|due\s+on|payment\s+due|please\s+pay\s+by|payable\s+by)[:\s]*([\s\S]{0,4}\d{1,2}[\/\-\.]\d{1,2}[\/\-\.]\d{2,4})/i,
    /(?:due\s+by|pay\s+by|due\s+on|payment\s+due)[:\s]*([\s\S]{0,4}\d{4}-\d{2}-\d{2})/i,
    // "Invoice Due: ..."
    new RegExp(`(?:invoice\\s+due|statement\\s+date|billing\\s+date|service\\s+date)[:\\s]*([\\s\\S]{0,4}${MONTH_NAMES}\\s+\\d{1,2},?\\s+\\d{4})`, "i"),
    /(?:invoice\s+due|statement\s+date|billing\s+date|service\s+date)[:\s]*([\s\S]{0,4}\d{1,2}[\/\-\.]\d{1,2}[\/\-\.]\d{2,4})/i,
  ];

  let dueDate: string | null = null;
  for (const pattern of labeledDatePatterns) {
    const m = normalized.match(pattern);
    if (m) {
      const parsed = parseDate(m[1].trim());
      if (parsed) {
        dueDate = parsed;
        console.log("[pdf-scan] date found via labeled pattern:", dueDate);
        break;
      }
    }
  }

  // If no labeled match, search for any date-like text near "due" keywords in raw text
  if (!dueDate) {
    const keywords = [
      /due\s+date/i,
      /payment\s+due/i,
      /due\s+by/i,
      /pay\s+by/i,
      /due\s+on/i,
      /payable\s+by/i,
      /please\s+pay\s+by/i,
      /invoice\s+due/i,
      /\bdue\b/i,
    ];
    for (const kw of keywords) {
      const found = findDateNear(normalized, kw, 80);
      if (found) {
        dueDate = found;
        console.log("[pdf-scan] date found via proximity search for", kw.source, ":", dueDate);
        break;
      }
    }
  }

  if (!dueDate) {
    console.log("[pdf-scan] no date found. Labels present:", normalized.match(/due|payment|pay\s+by|billing/ig));
  }

  // ── Biller hint extraction ─────────────────────────────────────────────────
  const billerPatterns = [
    /(?:^|\n)(?:from|biller|company|vendor|payee|service\s+provider)[:\s]+([A-Z][A-Za-z0-9&\s,.-]+)/i,
    /(?:^|\n)([A-Z][A-Za-z\s]+(?:Inc\.?|LLC\.?|Corp\.?|Electric|Gas|Water|Energy|Telecom|Communications|Services|Solutions)?)\s*\n/m,
  ];

  let billerHint: string | null = null;
  for (const pattern of billerPatterns) {
    const m = text.match(pattern);
    if (m) {
      billerHint = m[1].trim().replace(/\s+/g, " ").substring(0, 60);
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
      rawTextPreview: data.text.substring(0, 1000).trim(),
    });
  } catch (err: any) {
    console.error("[pdf-scan] parse error:", err);
    res.status(500).json({ error: "Failed to parse PDF. Make sure it is a text-based PDF (not a scanned image)." });
  }
});

export default router;
