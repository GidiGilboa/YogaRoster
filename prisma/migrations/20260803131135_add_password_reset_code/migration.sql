-- AlterTable
ALTER TABLE "Teacher" ADD COLUMN "passwordResetCodeExpiresAt" DATETIME;
ALTER TABLE "Teacher" ADD COLUMN "passwordResetCodeHash" TEXT;
