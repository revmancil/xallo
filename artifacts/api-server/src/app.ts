import express, { type Express, type Request, type Response, type NextFunction } from "express";
import cors from "cors";
import cookieParser from "cookie-parser";
import pinoHttp from "pino-http";
import router from "./routes";
import { logger } from "./lib/logger";
import { authMiddleware } from "./middlewares/authMiddleware";

const app: Express = express();

app.use(
  pinoHttp({
    logger,
    serializers: {
      req(req) {
        return {
          id: req.id,
          method: req.method,
          url: req.url?.split("?")[0],
        };
      },
      res(res) {
        return {
          statusCode: res.statusCode,
        };
      },
    },
  }),
);
app.use(cors({ credentials: true, origin: true }));
app.use(cookieParser());
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

// Fallback: if no body parser ran AND there is no Content-Type header at all
// (e.g. a proxy stripped it), read the raw stream and attempt JSON parsing.
// IMPORTANT: Skip when Content-Type exists — that covers multipart/form-data
// uploads (used by PDF scanner) which must not have their stream consumed here.
app.use((req: Request, _res: Response, next: NextFunction) => {
  const hasContentType = !!req.headers["content-type"];
  if (req.body !== undefined || hasContentType || !["POST", "PUT", "PATCH"].includes(req.method)) {
    return next();
  }
  const chunks: Buffer[] = [];
  req.on("data", (chunk: Buffer) => chunks.push(chunk));
  req.on("end", () => {
    const raw = Buffer.concat(chunks).toString("utf8").trim();
    if (raw.startsWith("{") || raw.startsWith("[")) {
      try {
        req.body = JSON.parse(raw);
      } catch {
        req.body = {};
      }
    } else {
      req.body = {};
    }
    next();
  });
  req.on("error", () => {
    req.body = {};
    next();
  });
});

app.use(authMiddleware);

app.use("/api", router);

export default app;
