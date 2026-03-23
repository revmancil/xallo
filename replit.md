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
- **bill_instances** — Individual bill occurrences with status (unpaid/paid/scheduled/overdue)
- **income_entries** — Payday/income records
- **bank_accounts** — Bank account balances (mock, structured for Plaid)

## Features

- **Dashboard**: Available Cash, Upcoming Bills (30 days), Safety Gap
- **Bills**: Full bill instance management with status filtering
- **Calendar**: Monthly view with color-coded bill indicators (Red=overdue, Yellow=unpaid, Blue=scheduled, Green=paid)
- **Billers**: CRUD management of biller templates
- **Income**: Payday tracking with recurrence support
- **Accounts**: Bank account balance management
- **Demo Mode**: Pre-seeded data for guest users (userId = "demo")
- **Auth**: Replit Auth login — users get their own data when authenticated

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

### `artifacts/prism-clone` (`@workspace/prism-clone`)

React + Vite frontend at `/` (root path). Pages: Dashboard, Bills, Calendar, Billers, Income, Accounts.

### `lib/db` (`@workspace/db`)

Database layer. Push schema: `pnpm --filter @workspace/db run push`

### `lib/api-spec` (`@workspace/api-spec`)

OpenAPI 3.1 spec + Orval config. Run codegen: `pnpm --filter @workspace/api-spec run codegen`

### `lib/replit-auth-web` (`@workspace/replit-auth-web`)

Browser auth hook. `import { useAuth } from "@workspace/replit-auth-web"`.
