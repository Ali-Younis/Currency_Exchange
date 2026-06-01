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

### Top Customers (`/reports/customers?limit=50`)
**All-time customer ranking by transaction count (admin + customers permission).**
- Queries the `Customer` table; counts non-voided transactions
- Returns: `rank`, `customerId`, `customerName`, `customerPhone`, `customerEmail`, `totalTransactions`, `createdAt`
- No date filter — always all-time; `limit` defaults to 25

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

---

## Phase 6 Features — Customer Management & Identity Documents

### Customer Entity
Every transaction now captures the customer's **phone number** (E.164 format, e.g. `+447700900000`). A `Customer` record is automatically created on the first transaction and linked to all subsequent transactions from the same phone number.

| Model | Key Fields |
|---|---|
| `Customer` | `id`, `phone` (unique), `name`, `email?`, `createdAt` |
| `CustomerDocument` | `id`, `customerId` (FK), `docType` (enum), `filePath`, `fileSize`, `mimeType`, `uploadedById` (FK) |
| `Transaction` | `customerPhone String?`, `customerId String?` (FK → Customer) |

Document types: `PASSPORT`, `PASSPORT_CARD`, `NATIONAL_ID`, `DRIVING_LICENSE`.

### Smart Phone Lookup (Transaction Forms)
All three transaction forms (Buy/Sell/Cross-Currency) include:
- **Phone field** — required, defaults to `+44`, validated against E.164 regex
- **Lookup badge** — on field blur, calls `GET /customers/lookup?phone=…`
  - New phone: shows `New Customer` badge
  - Known phone: shows `X previous transactions · TYPE(S)` badge (e.g. `3 previous transactions · BUY, SELL`)
- **Proof of Identity** — optional document upload (JPEG/PNG/WebP/PDF, max 10 MB) with document-type selector

### Customer Inventory Page (`/customers`)
Accessible to staff with the `customers` permission. Features:
- Summary stats: total customers, transactions, documents stored
- Search by name, phone, or email
- Expandable customer rows showing all uploaded identity documents
- Per-document: download button (auth-aware fetch → file blob); delete button (admin only)
- Upload new document without re-doing a transaction

### Customer Inventory API
| Endpoint | Description |
|---|---|
| `GET /customers/lookup?phone=` | Smart lookup — returns badge data |
| `GET /customers?limit=N` | List all customers with transaction + document counts |
| `GET /customers/:id` | Single customer with full documents list |
| `POST /customers/:id/documents` | Upload identity document (multipart/form-data) |
| `GET /customers/:id/documents` | List documents |
| `GET /customers/:id/documents/:docId/download` | Stream download |
| `DELETE /customers/:id/documents/:docId` | Delete (admin only) |

Document files are stored at `/app/customer-docs/` inside the API container (Docker volume `customer_docs_data`). The directory is configurable via the `customer_docs_directory` AppSetting.

### Forgot Password Flow
End-to-end password reset:
1. Login page has "Forgot password?" link → `/forgot-password`
2. User enters email → `POST /auth/forgot-password` (always returns 200; never reveals whether email exists)
3. If email matches active user, a reset link is emailed: `FRONTEND_URL/reset-password?token=<uuid>` (1-hour TTL)
4. Reset page reads `?token` from URL → validates → `POST /auth/reset-password` → password updated
5. User redirected to login after 3 seconds

> SMTP must be configured in **Settings → Email** for reset emails to send.

---

## Database Sizing & Scalability

### Storage Breakdown (at ~200 transactions/day)

| Data type | Annual growth | Notes |
|---|---|---|
| PostgreSQL rows (transactions, etc.) | ~50–100 MB/year | Pure relational data; no blobs in DB |
| PDF receipts (`/app/pdf-receipts/`) | ~3–4 GB/year | ~50 KB avg per transaction receipt |
| Customer identity documents (`/app/customer-docs/`) | ~1–2 GB/year | ~500 KB avg per document, ~1–2 docs/customer |
| JSON backups (`/app/backups/`) | ~50–200 MB/year | Compressed JSON exports |
| **Total** | **~5–7 GB/year** | |

A **50 GB** server comfortably handles **7–10 years** of operation. A **100 GB** server is effectively unlimited for this scale.

### PostgreSQL Scalability
PostgreSQL handles tables with hundreds of millions of rows without issue. The current schema (indexed `customerId`, `sessionDate`, `type`, `isVoided`) is well-suited for the query patterns used. No sharding or partitioning is needed at this scale.

### Recommendations
- Set a **backup retention policy** (e.g., keep 90 days of JSON backups)
- Add **disk monitoring** on `/app/customer-docs/` and `/app/pdf-receipts/` (alert at 80% capacity)
- Consider **S3/blob storage** only if volume grows to >100 customers/day
- The `FRONTEND_URL` env var must be set to the server's public URL for password reset emails to contain correct links
