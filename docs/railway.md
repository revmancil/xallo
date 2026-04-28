# Deploy on Railway (leave Replit)

This app is a **monorepo**: the **Express API** (`artifacts/api-server`) plus a **React UI** (`artifacts/prism-clone`). PostgreSQL holds data. On Replit, all of that ran together; on Railway you recreate that with one or two services.

## Recommended: one Railway service (API + UI)

Same public URL for `https://your-app.up.railway.app/` and `https://your-app.up.railway.app/api/...` avoids cross-site cookies and extra CORS setup.

1. **Create a Railway project** and add **PostgreSQL** (template). Copy **`DATABASE_URL`** from the Postgres service variables.
2. **New service from this GitHub repo** (or connect the repo and deploy).
3. **Builder**: use the repo **`Dockerfile`** at the root (Railway: Settings → Build → Dockerfile path: `Dockerfile`).
4. **Variables** (service → Variables), at minimum:

| Variable | Purpose |
|----------|---------|
| `DATABASE_URL` | From Railway Postgres (linked or pasted). |
| `OIDC_CLIENT_ID` | Same value as Replit’s **`REPL_ID`** / OAuth client id for Replit Auth. |
| `ISSUER_URL` | Optional; default is `https://replit.com/oidc`. |
| `ENCRYPTION_KEY` | 32+ char secret for encrypting tokens at rest (do not use the dev placeholder in production). |

5. **Replit Auth redirect URLs**  
   In Replit’s auth / OAuth settings for this app, add your Railway URLs, for example:

   - `https://<your-service>.up.railway.app/api/callback`  
   - (If you use a custom domain, include that host too.)

   If Replit does not allow your Railway callback, you will need a different identity provider (Auth0, Clerk, Google OIDC, etc.) and code changes beyond this guide.

6. **Database schema**  
   After the first deploy (or from your machine with `DATABASE_URL` pointing at Railway Postgres), run:

   ```bash
   pnpm install
   pnpm --filter @workspace/db run push
   ```

   Optionally seed demo data:

   ```bash
   pnpm --filter @workspace/scripts run seed
   ```

7. **Optional integrations** (only if you use them): `PLAID_*`, `STRIPE_*`, `AGENTMAIL_API_KEY`, Gmail/Replit connector vars from `replit.md` — many are Replit-specific; Gmail/Stripe may need reconfiguration on Railway.

The Docker image sets **`PRISM_STATIC_ROOT`** so the API serves the built Prism UI; you do **not** need `VITE_API_BASE_URL` on that setup.

## Alternative: API on Railway, UI on GitHub Pages

1. Deploy **only** the API (same Dockerfile but you could omit the Prism `RUN` steps and unset `PRISM_STATIC_ROOT`, or use a slimmer custom image).
2. In GitHub Actions variables, set **`VITE_API_BASE_URL`** to `https://<your-api>.up.railway.app` (no `/api` suffix).
3. Expect extra work for **login cookies** across `github.io` and Railway (`SameSite=None`, HTTPS, CORS).

## Auth note

Login still uses **Replit’s OIDC** (`ISSUER_URL` + `OIDC_CLIENT_ID`). Moving fully off Replit usually means switching to another IdP and updating the server auth routes — that is a larger change than deployment alone.

## Nixpacks (no Docker)

If you prefer Railway’s default builder instead of Docker:

- **Root directory**: repository root.  
- **Build**:  
  `corepack enable && corepack prepare pnpm@9 --activate && pnpm install --frozen-lockfile && pnpm --filter @workspace/prism-clone run build && mkdir -p /app/prism-static && cp -r artifacts/prism-clone/dist/public/* /app/prism-static/ && pnpm --filter @workspace/api-server run build`  
- **Start**:  
  `cd artifacts/api-server && PRISM_STATIC_ROOT=/app/prism-static node --enable-source-maps ./dist/index.mjs`  

Set **`NODE_VERSION=24`** (or equivalent) so Node matches the repo. Adjust paths if Railway’s working directory differs.

Railway injects **`PORT`**; the server already reads it.
