-- ────────────────────────────────────────────────────────────────────────────
-- Migration: 20260514000001_add_phase2_fields
-- Adds TOTP/permissions fields to users, countryCode to currencies,
-- customerEmail to transactions, and the new app_settings table.
-- ────────────────────────────────────────────────────────────────────────────

-- ── Users: new columns ───────────────────────────────────────────────────────
ALTER TABLE "users"
    ADD COLUMN IF NOT EXISTS "forcePasswordChange" BOOLEAN      NOT NULL DEFAULT false,
    ADD COLUMN IF NOT EXISTS "totpSecret"           TEXT,
    ADD COLUMN IF NOT EXISTS "totpEnabled"          BOOLEAN      NOT NULL DEFAULT false,
    ADD COLUMN IF NOT EXISTS "permissions"          JSONB        NOT NULL DEFAULT '[]';

-- ── Currencies: countryCode ──────────────────────────────────────────────────
ALTER TABLE "currencies"
    ADD COLUMN IF NOT EXISTS "countryCode" VARCHAR(2);

-- ── Transactions: customerEmail ──────────────────────────────────────────────
ALTER TABLE "transactions"
    ADD COLUMN IF NOT EXISTS "customerEmail" VARCHAR(255);

-- ── App Settings ─────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS "app_settings" (
    "key"       TEXT         NOT NULL,
    "value"     TEXT         NOT NULL,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "app_settings_pkey" PRIMARY KEY ("key")
);
