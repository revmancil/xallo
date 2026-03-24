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

// Fallback: if no body parser ran (e.g. proxy stripped Content-Type),
// read the raw stream and attempt JSON parsing.
app.use((req: Request, _res: Response, next: NextFunction) => {
  if (req.body !== undefined || !["POST", "PUT", "PATCH"].includes(req.method)) {
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
