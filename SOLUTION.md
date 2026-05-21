# Exchange Manager — Solution Architecture

## Overview

Exchange Manager is a full-stack, containerised currency exchange agency management system. It enables staff to record buy/sell transactions, manage exchange rates, track opening balances, generate end-of-day reports, and administer users — all from a browser-based interface.

---

## Architecture

```
┌─────────────────────────────────────────────────────────────────┐
│                         Docker Compose                          │
│                                                                 │
│  ┌──────────┐    ┌──────────┐    ┌──────────────────────────┐  │
│  │ postgres │    │  redis   │    │          nginx            │  │
│  │ (port 5432)  │ (port 6379)  │  port 80 → reverse proxy  │  │
│  └────┬─────┘    └────┬─────┘    └─────────┬────────────────┘  │
│       │               │                    │                   │
│  ┌────▼──────────────▼────┐   ┌────────────▼──────────────┐   │
│  │     NestJS API (3001)  │   │   Next.js Web App (3000)  │   │
│  │  ─ JWT authentication  │   │  ─ React 19               │   │
│  │  ─ Prisma ORM (pg)     │   │  ─ next-intl (EN/AR)      │   │
│  │  ─ TOTP (otplib)       │   │  ─ TanStack Query         │   │
│  │  ─ Email (nodemailer)  │   │  ─ Tailwind CSS            │   │
│  └────────────────────────┘   └───────────────────────────┘   │
└─────────────────────────────────────────────────────────────────┘
```

### Technology Stack

| Layer | Technology |
|---|---|
| Runtime | Node.js 20 (Alpine) |
| API Framework | NestJS 11 |
| Frontend Framework | Next.js 16 (standalone output) |
| Database | PostgreSQL 16 |
| ORM | Prisma 7 (with `@prisma/adapter-pg`) |
| Cache / Token Blacklist | Redis 7 + ioredis |
| Auth | JWT + TOTP (otplib) |
| Email | nodemailer (SMTP) |
| Containerisation | Docker Compose |
| Monorepo | npm workspaces + Turborepo |

---

## Repository Structure

```
exchange-system/
├── apps/
│   ├── api/               # NestJS backend
│   │   ├── prisma/        # Schema + seed data
│   │   └── src/           # Modules: auth, users, currencies, …
│   └── web/               # Next.js frontend
│       ├── src/app/       # Route pages (App Router)
│       ├── src/components/# Shared React components
│       └── messages/      # i18n JSON (en, ar)
└── packages/
    └── shared/            # TypeScript DTOs & interfaces
```

---

## Features Implemented

### Phase 1 — UI Polish
- Show/hide password toggle on login
- Language switcher (EN / AR) in sidebar for all users
- `formatNumber` utility that always uses `en-US` locale (prevents Arabic-Indic numerals)
- Removed RTL-specific note from settings page

### Phase 2 — Database Schema
- `User.forcePasswordChange`, `User.totpSecret`, `User.totpEnabled`, `User.permissions`
- `Currency.countryCode` (ISO 3166-1 alpha-2)
- `Transaction.customerEmail`
- `AppSetting` model (key–value store for logo, SMTP credentials)
- Seed data updated with country codes for all 12 currencies

### Phase 3 — Authentication
- **Mandatory TOTP**: All users must enrol on first login; all subsequent logins require a 6-digit code
- **Password Policy**: Minimum 12 chars, uppercase, lowercase, digit, special character
- **Force Password Change**: New users or admin-triggered; redirect to `/change-password` before login completes
- Multi-step login flow via short-lived pre-auth JWT tokens (blacklisted in Redis after single use)
- Pages: `/change-password`, `/totp-enroll`, `/totp-verify`

### Phase 4 — Features

#### Backend
- `AppSettingsModule` — key-value store for runtime configuration
- `EmailModule` — nodemailer-based email with SMTP config from database
- `GET /balances/current` — real-time balance computation (opening + buys − sells)
- `PATCH /users/:id` — now accepts `permissions`, `forcePasswordChange`, `totpEnabled`, `totpSecret`
- `POST /app-settings/email/test` — send a test email to verify SMTP configuration
- Currency DTO — now includes `countryCode`
- Transaction DTO — now includes `customerEmail`

#### Frontend
- **Transaction Form** — optional `customerEmail` field; PDF receipt via jsPDF (replaces `window.print()`)
- **Currencies page** — country flag emoji column derived from `countryCode`
- **Current Balances page** (`/current-balances`) — live table, auto-refreshes every 30s
- **Users page** — permissions grid for tellers, `forcePasswordChange` toggle, TOTP reset
- **Settings page** — logo upload (stored as base64 in AppSetting), SMTP configuration, test email
- **Sidebar** — shows company logo from AppSetting `logo_base64` if configured

### Phase 5 — QA
- **Playwright e2e tests** (`apps/web/e2e/`) — auth redirect, login validation, transaction form structure
- **Jest unit tests** (`apps/api/test/`) — AppSettingsService, BalancesService calculations, API security (401 checks)

---

## Security

- Passwords hashed with bcrypt (12 rounds)
- JWT signed with HS256; short-lived pre-auth tokens are single-use (Redis blacklist)
- TOTP enforced for all users (HOTP-based 6-digit codes via `otplib`)
- Input validation via `class-validator` on all DTOs
- Role-based access (ADMIN / TELLER) + per-section permissions for telller
- SMTP password stored encrypted-at-rest in database (not in environment variables)
- `logo_base64` stored in DB — no file system writes needed

---

## Configuration

All runtime configuration is passed via Docker Compose environment variables (see `docker-compose.yml`):

| Variable | Description |
|---|---|
| `DATABASE_URL` | PostgreSQL connection string |
| `REDIS_URL` | Redis connection string |
| `JWT_SECRET` | HS256 signing key for full-access tokens |
| `JWT_SHORT_SECRET` | HS256 key for pre-auth/enroll tokens |
| `JWT_EXPIRES_IN` | Access token TTL (default: `8h`) |
| `NEXT_PUBLIC_API_URL` | Frontend → API base URL |

SMTP configuration is managed **at runtime** through the Settings page (stored in the `app_settings` table).

---

## Running the System

```bash
cd exchange-system
docker compose up --build
```

- Web app: http://localhost
- API: http://localhost/api/v1
- Default admin credentials: `admin` / `Admin@Change123!` (set in seed; **must change on first login**)

See `RUNNING.md` for detailed setup instructions.

---

## Database Migrations

Schema changes are applied automatically at container startup via `prisma migrate deploy`.  
Seed data is applied via `prisma db seed` in the API Docker entrypoint.

---

## Self-Containment

The system has **no host dependencies** beyond Docker and Docker Compose. All npm packages are declared in `package.json` files and installed during `docker build`. No `npm install` is ever run on the host machine.

---

## Reports Reference

All reports are served from `GET /reports/<endpoint>` and require a valid JWT.

### Session Report (`/reports/session?date=YYYY-MM-DD`)
**Per-currency daily summary.**
- Opening balance: latest `OpeningBalance` record with `sessionDate ≤ requested date` (carry-forward)
- `totalBuys` = Σ `amountIn` for all non-voided transactions where the currency came **in** on that date
- `totalSells` = Σ `amountOut` for all non-voided transactions where the currency went **out** on that date
- `closingBalance` = `openingBalance + totalBuys − totalSells`

### Daily Ledger (`/reports/ledger?date=YYYY-MM-DD`)
**All non-voided transactions for a session date**, returned in chronological order with full currency and teller details. Split into `buys`, `sells`, and `total` count.

### Profit Report (`/reports/profit?startDate=…&endDate=…`)
**Spread profit analysis per currency over a date range (admin only).**
- `totalVolumeGbp` = Σ `valueInGbp` for all transactions involving that currency
- `totalProfitGbp` = Σ `spreadProfitGbp` (calculated at transaction time as `|amountIn − amountOut|` converted to GBP)
- `avgProfitPerTxnGbp` = `totalProfitGbp ÷ totalTransactions`
- Includes `grandTotalProfitGbp` and `grandTotalVolumeGbp` across all currencies

### Volume Report (`/reports/volume?startDate=…&endDate=…&groupBy=day|week|month`)
**Transaction count and GBP volume over time, grouped into buckets (admin only).**
- Optional `currencyId` query param to filter to a single currency
- `trendPoints[]`: each bucket has `date` (bucket start), `count`, `volumeGbp`, `buys`, `sells`
- Week buckets start on Monday (ISO); month buckets start on the 1st

### Top Customers (`/reports/top-customers?startDate=…&endDate=…&limit=20`)
**Customers ranked by total GBP volume (admin only).**
- `totalVolumeGbp`, `totalProfitGbp`, `totalTransactions` per customer name
- Sorted descending by volume; `limit` defaults to 20

### Rate History (`/reports/rate-history/:currencyId?startDate=…&endDate=…`)
**Historical buy/sell rates for a currency (admin only).**
- Returns each `ExchangeRate` record in date order with `buyRate`, `sellRate`, and computed `spread = sellRate − buyRate`

### Audit Trail (`/reports/audit?startDate=…&endDate=…&action=…&userId=…&page=1&pageSize=50`)
**Paginated log of all administrative actions (admin only).**
- Filters: date range, action keyword (case-insensitive contains), user ID
- Returns `data[]`, `total`, `page`, `pageSize`
- Actions include: `SET_OPENING_BALANCE`, `CREATE_CURRENCY`, `UPDATE_RATE`, `VOID_TRANSACTION`, etc.

### End-of-Day Report (`/reports/end-of-day?date=YYYY-MM-DD`)
**Session summary enriched with totals (admin only).**
- Combines `getSessionReport` results with aggregate stats:
  - `totalTransactions` (non-voided), `voidedTransactions`
  - `totalVolumeGbp`, `totalProfitGbp`
  - `balances[]` — same rows as Session Report
