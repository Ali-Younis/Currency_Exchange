-- CreateEnum
CREATE TYPE "DocumentType" AS ENUM ('PASSPORT', 'PASSPORT_CARD', 'NATIONAL_ID', 'DRIVING_LICENSE');

-- CreateTable: customers
CREATE TABLE "customers" (
    "id"        TEXT NOT NULL,
    "phone"     VARCHAR(20) NOT NULL,
    "name"      VARCHAR(200) NOT NULL,
    "email"     VARCHAR(255),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "customers_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "customers_phone_key" ON "customers"("phone");
CREATE INDEX "customers_phone_idx" ON "customers"("phone");

-- CreateTable: customer_documents
CREATE TABLE "customer_documents" (
    "id"           TEXT NOT NULL,
    "customerId"   TEXT NOT NULL,
    "docType"      "DocumentType" NOT NULL,
    "originalName" VARCHAR(255) NOT NULL,
    "storedName"   VARCHAR(255) NOT NULL,
    "filePath"     VARCHAR(500) NOT NULL,
    "fileSize"     INTEGER NOT NULL,
    "mimeType"     VARCHAR(100) NOT NULL,
    "uploadedById" TEXT NOT NULL,
    "uploadedAt"   TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "customer_documents_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "customer_documents_storedName_key" ON "customer_documents"("storedName");
CREATE INDEX "customer_documents_customerId_idx" ON "customer_documents"("customerId");

-- AlterTable: transactions — add customerPhone and customerId (nullable for backward compat)
ALTER TABLE "transactions"
    ADD COLUMN "customerPhone" VARCHAR(20),
    ADD COLUMN "customerId"    TEXT;

CREATE INDEX "transactions_customerId_idx" ON "transactions"("customerId");

-- AddForeignKey: customer_documents → customers
ALTER TABLE "customer_documents"
    ADD CONSTRAINT "customer_documents_customerId_fkey"
    FOREIGN KEY ("customerId") REFERENCES "customers"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey: customer_documents → users
ALTER TABLE "customer_documents"
    ADD CONSTRAINT "customer_documents_uploadedById_fkey"
    FOREIGN KEY ("uploadedById") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey: transactions → customers
ALTER TABLE "transactions"
    ADD CONSTRAINT "transactions_customerId_fkey"
    FOREIGN KEY ("customerId") REFERENCES "customers"("id") ON DELETE SET NULL ON UPDATE CASCADE;
