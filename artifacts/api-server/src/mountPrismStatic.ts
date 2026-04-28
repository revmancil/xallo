import path from "node:path";
import fs from "node:fs";
import express, { type Express } from "express";
import { logger } from "./lib/logger";

/**
 * When PRISM_STATIC_ROOT points at prism-clone's Vite `dist/public`, serve the SPA from the
 * same origin as the API (good for Railway: one URL, cookies, no CORS for /api).
 */
export function mountPrismStaticIfConfigured(app: Express): void {
  const raw = process.env.PRISM_STATIC_ROOT?.trim();
  if (!raw) return;

  const abs = path.resolve(raw);
  if (!fs.existsSync(path.join(abs, "index.html"))) {
    logger.warn(
      { abs },
      "PRISM_STATIC_ROOT set but index.html missing; skipping static UI",
    );
    return;
  }

  app.use(express.static(abs));
  app.get("*", (req, res, next) => {
    if (req.path.startsWith("/api")) {
      next();
      return;
    }
    if (req.method !== "GET" && req.method !== "HEAD") {
      next();
      return;
    }
    res.sendFile(path.join(abs, "index.html"));
  });

  logger.info({ abs }, "Serving Prism UI from PRISM_STATIC_ROOT");
}
