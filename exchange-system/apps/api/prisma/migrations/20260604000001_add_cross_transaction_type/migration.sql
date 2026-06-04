-- Add CROSS value to the TransactionType enum
ALTER TYPE "TransactionType" ADD VALUE IF NOT EXISTS 'CROSS';
