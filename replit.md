# Workspace

## Overview

PrismClone - A full-stack bill management and cash flow dashboard inspired by the defunct "Prism" app. Helps users track upcoming bills, monitor bank balances, and visualize cash flow.

## Stack

- **Monorepo tool**: pnpm workspaces
- **Node.js version**: 24
- **Package manager**: pnpm
- **TypeScript version**: 5.9
- **API framework**: Express 5
- **Database**: PostgreSQL + Drizzle ORM
- **Validation**: Zod (`zod/v4`), `drizzle-zod`
- **API codegen**: Orval (from OpenAPI spec)
- **Build**: esbuild (CJS bundle)
- **Frontend**: React + Vite + Tailwind CSS
- **Auth**: Replit Auth (OpenID Connect + PKCE)

## Structure

```text
artifacts-monorepo/
├── artifacts/              # Deployable applications
│   ├── api-server/         # Express API server
│   └── prism-clone/        # React + Vite frontend (at /)
├── lib/                    # Shared libraries
│   ├── api-spec/           # OpenAPI spec + Orval codegen config
│   ├── api-client-react/   # Generated React Query hooks
│   ├── api-zod/            # Generated Zod schemas from OpenAPI
│   ├── db/                 # Drizzle ORM schema + DB connection
│   └── replit-auth-web/    # Browser auth hooks (useAuth)
├── scripts/                # Utility scripts
│   └── src/seed.ts         # Demo data seeder (pnpm --filter @workspace/scripts run seed)
├── pnpm-workspace.yaml
├── tsconfig.base.json
├── tsconfig.json
└── package.json
```

## Database Schema

- **users** — Auth users table (Replit Auth)
- **sessions** — Session storage for Replit Auth
- **billers** — Biller records (name, category, typical amount, recurrence)
- **bill_instances** — Individual bill occurrences with status (unpaid/paid/scheduled/overdue), includes `confirmationNumber` + `paidAt`
- **income_entries** — Payday/income records
- **bank_accounts** — Bank account balances (manual or auto-imported via Plaid)
- **plaid_items** — Stored Plaid access tokens per user/institution
- **security_logs** — Security audit log (IP, action, metadata, timestamp)
- **user_2fa** — TOTP 2FA secrets per user (AES-256-GCM encrypted)
- **email_imports** — AgentMail import job records (inbox polling, parsed bill data)
- **credit_cards** — Credit card records (name, institution, last four, limit, balance, APR, due day, min payment, color)

## Features

- **Dashboard**: Available Cash, Upcoming Bills (30 days), Safety Gap, Cash Flow Projection (Safe to Spend, Running Balance timeline, Next Payday)
- **Bills**: Full bill instance management with status filtering; "Mark as Paid" with optional confirmation number entry; **History tab** (audit log of all paid bills with date, amount, confirmation #)
- **Calendar**: Monthly view with color-coded bill indicators + income (green paydays); clickable days with slide-over panel
- **Billers**: CRUD management of biller templates
- **Income**: Payday tracking with recurrence support
- **Accounts**: Bank account balance management + **Credit Cards** section (limits, balances, utilization bars with green/amber/red thresholds, APR, due day, min payment, color picker) + **Plaid integration** (Link Account button, token exchange, depository account import)
- **Analytics**: 6-month spending bar chart (Recharts), Top 5 Billers by spend, Subscription Watcher (flags >10% month-over-month price changes)
- **Security**: Audit Log table (action/IP/timestamp), TOTP 2FA setup (speakeasy + QR code), PDF Bill Scanner (multer + pdf-parse extracts amount & due date)
- **AES-256-GCM Encryption**: Plaid tokens and 2FA secrets encrypted at rest via `lib/encryption.ts`
- **Notification Bell**: Smart in-app alerts — Bill Due Today/Tomorrow, Overdue Bills, Low Balance Warning (Safety Gap < $200)
- **Demo Mode**: Pre-seeded data for guest users (userId = "demo")
- **Auth**: Replit Auth login — users get their own data when authenticated

## Plaid Integration

Set these environment variables to activate Plaid:
- `PLAID_CLIENT_ID` — from dashboard.plaid.com
- `PLAID_SECRET` — sandbox secret from dashboard.plaid.com
- `PLAID_ENV` — defaults to `sandbox`

Plaid API routes:
- `GET /api/plaid/status` — check if configured
- `POST /api/plaid/create-link-token` — create Plaid Link token
- `POST /api/plaid/exchange-token` — exchange public_token, import accounts
- `GET /api/plaid/liabilities` — fetch credit card liabilities
- `GET /api/plaid/transactions` — fetch 90-day transactions + discover recurring bills

## TypeScript & Composite Projects

Every package extends `tsconfig.base.json` which sets `composite: true`.

- **Always typecheck from the root** — run `pnpm run typecheck`
- `emitDeclarationOnly` — only emit `.d.ts` files during typecheck

## Root Scripts

- `pnpm run build` — runs `typecheck` first, then recursively runs `build` in all packages
- `pnpm run typecheck` — runs `tsc --build --emitDeclarationOnly` using project references
- `pnpm --filter @workspace/scripts run seed` — re-seed demo data

## Packages

### `artifacts/api-server` (`@workspace/api-server`)

Express 5 API server. Routes at `/api`:
- `/api/auth/user` — current user
- `/api/login`, `/api/callback`, `/api/logout` — Replit Auth
- `/api/billers` — CRUD billers
- `/api/bills` — CRUD bill instances (supports ?month=&year= query)
- `/api/income` — CRUD income entries
- `/api/accounts` — CRUD bank accounts
- `/api/credit-cards` — CRUD credit card records (limit, balance, APR, due day, min payment, color)
- `/api/dashboard` — dashboard summary stats

All routes support "demo mode" (unauthenticated requests use `userId = "demo"`).

## Vite Routing Fix

The Replit proxy strips the `/prism-clone` prefix before forwarding to Vite, so `import.meta.env.BASE_URL` = `/` in the dev server, but the browser still sees `/prism-clone/...` URLs. Wouter needs to know the actual browser prefix.

Fix: `artifacts/prism-clone/.env.local` sets `VITE_ROUTER_BASE=/prism-clone`. App.tsx reads this via `import.meta.env.VITE_ROUTER_BASE` to pass the correct base to `<WouterRouter base={...}>`.

If the artifact slug changes, update `VITE_ROUTER_BASE` accordingly.

Plaid routes (no codegen — called via raw fetch in frontend):
- `GET /api/plaid/status`
- `POST /api/plaid/create-link-token`
- `POST /api/plaid/exchange-token`
- `GET /api/plaid/liabilities`
- `GET /api/plaid/transactions`

Analytics routes (no codegen):
- `GET /api/analytics/monthly` — 6-month bill spending totals
- `GET /api/analytics/subscription-changes` — month-over-month biller price changes
- `GET /api/analytics/summary` — this month summary + top 5 billers

Security routes (no codegen):
- `GET /api/security/logs` — user audit log
- `POST /api/security/log` — log a custom event
- `GET /api/security/2fa/status` — check if 2FA enabled
- `POST /api/security/2fa/setup` — generate TOTP secret + QR code
- `POST /api/security/2fa/verify` — verify token, enable 2FA
- `POST /api/security/2fa/disable` — disable 2FA
- `POST /api/pdf/parse` — parse PDF bill (multipart/form-data, field: `file`)

Gmail Import routes (no codegen — raw fetch in frontend):
- `POST /api/gmail/sync` — scan Gmail inbox for bill emails (last 90 days); requires auth (not available in demo mode)
- `GET /api/gmail/imports` — list email imports for user
- `POST /api/gmail/imports/:id/create-bill` — create a bill instance from an import (body: `{ billerId }`)
- `DELETE /api/gmail/imports/:id` — dismiss/delete an import

Gmail client: `artifacts/api-server/src/lib/gmail-client.ts`
- Uses Replit connector `google-mail` (connection ID: `conn_google-mail_01KMGA02202SHG8SD2FV4GX4DJ`)
- NOTE: If Gmail stops working, call `proposeIntegration("connection:conn_google-mail_01KMGA02202SHG8SD2FV4GX4DJ")` to re-authorize
- Never cache the Gmail client — tokens expire; always call `getUncachableGmailClient()` fresh

Packages installed in api-server: plaid, multer, speakeasy, qrcode, pdf-parse@1.1.1, googleapis@148.0.0 (+ @types)

### `artifacts/prism-clone` (`@workspace/prism-clone`)

React + Vite frontend at `/` (root path). Pages: Dashboard, Bills, Calendar, Billers, Income, Accounts, Analytics, Security, Budget, Gmail Import.

**Responsive design**: Fully responsive for phone, tablet, and desktop.
- Bottom nav (mobile) uses 6 items with `flex-1` layout — all fit without overflow.
- A custom `xs` breakpoint (480px / 30rem) is defined in `src/index.css` via `@theme inline { --breakpoint-xs: 30rem }`.
- Dashboard stat cards scale from `text-xl` (tablet) → `text-3xl` (xl+) to prevent clipping alongside the sidebar.
- Bills page header buttons collapse to icon-only on mobile (`hidden sm:inline` for labels).
- Filter tabs and Security tabs use `overflow-x-auto` scrollable containers.
- Billers cards use a horizontal (icon-left) layout instead of stacked.
- Income list uses a card layout instead of a fixed-column table.

### `lib/db` (`@workspace/db`)

Database layer. Push schema: `pnpm --filter @workspace/db run push`

### `lib/api-spec` (`@workspace/api-spec`)

OpenAPI 3.1 spec + Orval config. Run codegen: `pnpm --filter @workspace/api-spec run codegen`

### `lib/replit-auth-web` (`@workspace/replit-auth-web`)

Browser auth hook. `import { useAuth } from "@workspace/replit-auth-web"`.
