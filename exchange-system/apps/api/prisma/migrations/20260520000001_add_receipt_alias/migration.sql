-- Migration: 20260520000001_add_receipt_alias
-- Adds an optional receipt display alias to the users table.

ALTER TABLE "users" ADD COLUMN IF NOT EXISTS "receiptAlias" TEXT;
