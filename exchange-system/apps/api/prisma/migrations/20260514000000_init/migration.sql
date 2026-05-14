-- ────────────────────────────────────────────────────────────────────────────
-- Migration: 20260514000000_init
-- Creates the complete Exchange Manager schema from scratch.
-- Safe to run on a fresh database — all CREATE statements use IF NOT EXISTS.
-- ────────────────────────────────────────────────────────────────────────────

-- ── Enums ────────────────────────────────────────────────────────────────────
CREATE TYPE "Role" AS ENUM ('ADMIN', 'TELLER');
CREATE TYPE "TransactionType" AS ENUM ('BUY', 'SELL');

-- ── Users ────────────────────────────────────────────────────────────────────
CREATE TABLE "users" (
    "id"           TEXT         NOT NULL,
    "username"     TEXT         NOT NULL,
    "passwordHash" TEXT         NOT NULL,
    "fullName"     TEXT         NOT NULL,
    "role"         "Role"       NOT NULL DEFAULT 'TELLER',
    "isActive"     BOOLEAN      NOT NULL DEFAULT true,
    "createdAt"    TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt"    TIMESTAMP(3) NOT NULL,

    CONSTRAINT "users_pkey" PRIMARY KEY ("id")
);
CREATE UNIQUE INDEX "users_username_key" ON "users"("username");

-- ── Currencies ───────────────────────────────────────────────────────────────
CREATE TABLE "currencies" (
    "id"        TEXT    NOT NULL,
    "code"      TEXT    NOT NULL,
    "nameEn"    TEXT    NOT NULL,
    "nameAr"    TEXT    NOT NULL,
    "symbol"    TEXT    NOT NULL,
    "isActive"  BOOLEAN NOT NULL DEFAULT true,
    "sortOrder" INTEGER NOT NULL DEFAULT 0,

    CONSTRAINT "currencies_pkey" PRIMARY KEY ("id")
);
CREATE UNIQUE INDEX "currencies_code_key" ON "currencies"("code");

-- ── Exchange Rates ────────────────────────────────────────────────────────────
CREATE TABLE "exchange_rates" (
    "id"            TEXT           NOT NULL,
    "currencyId"    TEXT           NOT NULL,
    "buyRate"       DECIMAL(18, 6) NOT NULL,
    "sellRate"      DECIMAL(18, 6) NOT NULL,
    "effectiveDate" TIMESTAMP(3)   NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "setById"       TEXT           NOT NULL,
    "createdAt"     TIMESTAMP(3)   NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "exchange_rates_pkey" PRIMARY KEY ("id")
);
CREATE INDEX "exchange_rates_currencyId_effectiveDate_idx" ON "exchange_rates"("currencyId", "effectiveDate");

-- ── Opening Balances ──────────────────────────────────────────────────────────
CREATE TABLE "opening_balances" (
    "id"          TEXT           NOT NULL,
    "currencyId"  TEXT           NOT NULL,
    "amount"      DECIMAL(18, 2) NOT NULL,
    "sessionDate" DATE           NOT NULL,
    "setById"     TEXT           NOT NULL,
    "createdAt"   TIMESTAMP(3)   NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "opening_balances_pkey" PRIMARY KEY ("id")
);
CREATE UNIQUE INDEX "opening_balances_currencyId_sessionDate_key" ON "opening_balances"("currencyId", "sessionDate");
CREATE INDEX "opening_balances_sessionDate_idx" ON "opening_balances"("sessionDate");

-- ── Transactions ──────────────────────────────────────────────────────────────
CREATE TABLE "transactions" (
    "id"              TEXT              NOT NULL,
    "receiptNumber"   TEXT              NOT NULL,
    "type"            "TransactionType" NOT NULL,
    "customerName"    TEXT              NOT NULL,
    "currencyInId"    TEXT              NOT NULL,
    "amountIn"        DECIMAL(18, 2)    NOT NULL,
    "currencyOutId"   TEXT              NOT NULL,
    "amountOut"       DECIMAL(18, 2)    NOT NULL,
    "rateApplied"     DECIMAL(18, 6)    NOT NULL,
    "valueInGbp"      DECIMAL(18, 2)    NOT NULL,
    "buyRateSnapshot" DECIMAL(18, 6),
    "sellRateSnapshot" DECIMAL(18, 6),
    "spreadProfitGbp" DECIMAL(18, 4),
    "notes"           TEXT,
    "isVoided"        BOOLEAN           NOT NULL DEFAULT false,
    "voidedAt"        TIMESTAMP(3),
    "voidedReason"    TEXT,
    "tellerId"        TEXT              NOT NULL,
    "createdAt"       TIMESTAMP(3)      NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "sessionDate"     DATE              NOT NULL,

    CONSTRAINT "transactions_pkey" PRIMARY KEY ("id")
);
CREATE UNIQUE INDEX "transactions_receiptNumber_key" ON "transactions"("receiptNumber");
CREATE INDEX "transactions_sessionDate_idx" ON "transactions"("sessionDate");
CREATE INDEX "transactions_tellerId_idx" ON "transactions"("tellerId");
CREATE INDEX "transactions_type_idx" ON "transactions"("type");

-- ── Audit Logs ────────────────────────────────────────────────────────────────
CREATE TABLE "audit_logs" (
    "id"        TEXT         NOT NULL,
    "userId"    TEXT,
    "action"    TEXT         NOT NULL,
    "entity"    TEXT,
    "entityId"  TEXT,
    "ipAddress" TEXT,
    "userAgent" TEXT,
    "payload"   JSONB,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "audit_logs_pkey" PRIMARY KEY ("id")
);
CREATE INDEX "audit_logs_userId_idx" ON "audit_logs"("userId");
CREATE INDEX "audit_logs_action_idx" ON "audit_logs"("action");
CREATE INDEX "audit_logs_createdAt_idx" ON "audit_logs"("createdAt");

-- ── Foreign Keys ──────────────────────────────────────────────────────────────
ALTER TABLE "exchange_rates"
    ADD CONSTRAINT "exchange_rates_currencyId_fkey" FOREIGN KEY ("currencyId") REFERENCES "currencies"("id") ON DELETE RESTRICT ON UPDATE CASCADE,
    ADD CONSTRAINT "exchange_rates_setById_fkey"    FOREIGN KEY ("setById")    REFERENCES "users"("id")      ON DELETE RESTRICT ON UPDATE CASCADE;

ALTER TABLE "opening_balances"
    ADD CONSTRAINT "opening_balances_currencyId_fkey" FOREIGN KEY ("currencyId") REFERENCES "currencies"("id") ON DELETE RESTRICT ON UPDATE CASCADE,
    ADD CONSTRAINT "opening_balances_setById_fkey"    FOREIGN KEY ("setById")    REFERENCES "users"("id")      ON DELETE RESTRICT ON UPDATE CASCADE;

ALTER TABLE "transactions"
    ADD CONSTRAINT "transactions_currencyInId_fkey"  FOREIGN KEY ("currencyInId")  REFERENCES "currencies"("id") ON DELETE RESTRICT ON UPDATE CASCADE,
    ADD CONSTRAINT "transactions_currencyOutId_fkey" FOREIGN KEY ("currencyOutId") REFERENCES "currencies"("id") ON DELETE RESTRICT ON UPDATE CASCADE,
    ADD CONSTRAINT "transactions_tellerId_fkey"      FOREIGN KEY ("tellerId")      REFERENCES "users"("id")      ON DELETE RESTRICT ON UPDATE CASCADE;

ALTER TABLE "audit_logs"
    ADD CONSTRAINT "audit_logs_userId_fkey" FOREIGN KEY ("userId") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;
