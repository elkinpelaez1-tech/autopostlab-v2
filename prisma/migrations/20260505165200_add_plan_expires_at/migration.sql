-- AlterTable
ALTER TABLE "Organization" ADD COLUMN "planExpiresAt" TIMESTAMP(3);
ALTER TABLE "Organization" ADD COLUMN "hadPro" BOOLEAN NOT NULL DEFAULT false;
