-- Add commission fields to transactions table
ALTER TABLE "transactions" ADD COLUMN "commission1" DECIMAL(18,2);
ALTER TABLE "transactions" ADD COLUMN "commission2" DECIMAL(18,2);
