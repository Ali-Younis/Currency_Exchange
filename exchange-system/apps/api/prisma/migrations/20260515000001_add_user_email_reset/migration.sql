-- AddColumn: email (unique, nullable for existing rows)
ALTER TABLE "users" ADD COLUMN "email" VARCHAR(255);
ALTER TABLE "users" ADD CONSTRAINT "users_email_key" UNIQUE ("email");

-- AddColumn: passwordResetToken (nullable)
ALTER TABLE "users" ADD COLUMN "passwordResetToken" TEXT;

-- AddColumn: passwordResetExpiry (nullable)
ALTER TABLE "users" ADD COLUMN "passwordResetExpiry" TIMESTAMP(3);
