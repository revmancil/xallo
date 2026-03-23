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

## Features

- **Dashboard**: Available Cash, Upcoming Bills (30 days), Safety Gap, Cash Flow Projection (Safe to Spend, Running Balance timeline, Next Payday)
- **Bills**: Full bill instance management with status filtering; "Mark as Paid" with optional confirmation number entry; **History tab** (audit log of all paid bills with date, amount, confirmation #)
- **Calendar**: Monthly view with color-coded bill indicators + income (green paydays); clickable days with slide-over panel
- **Billers**: CRUD management of biller templates
- **Income**: Payday tracking with recurrence support
- **Accounts**: Bank account balance management + **Plaid integration** (Link Account button, token exchange, depository account import)
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
- `/api/dashboard` — dashboard summary stats

All routes support "demo mode" (unauthenticated requests use `userId = "demo"`).

Plaid routes (no codegen — called via raw fetch in frontend):
- `GET /api/plaid/status`
- `POST /api/plaid/create-link-token`
- `POST /api/plaid/exchange-token`
- `GET /api/plaid/liabilities`
- `GET /api/plaid/transactions`

### `artifacts/prism-clone` (`@workspace/prism-clone`)

React + Vite frontend at `/` (root path). Pages: Dashboard, Bills, Calendar, Billers, Income, Accounts.

### `lib/db` (`@workspace/db`)

Database layer. Push schema: `pnpm --filter @workspace/db run push`

### `lib/api-spec` (`@workspace/api-spec`)

OpenAPI 3.1 spec + Orval config. Run codegen: `pnpm --filter @workspace/api-spec run codegen`

### `lib/replit-auth-web` (`@workspace/replit-auth-web`)

Browser auth hook. `import { useAuth } from "@workspace/replit-auth-web"`.
