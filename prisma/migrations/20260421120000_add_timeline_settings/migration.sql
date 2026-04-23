-- AddColumn: productionDurationDays and excludeSundays to Project
-- excludeSundays defaults to false so all existing project dates are unchanged.

-- AlterTable
ALTER TABLE "Project" ADD COLUMN "productionDurationDays" INTEGER NOT NULL DEFAULT 28;
ALTER TABLE "Project" ADD COLUMN "excludeSundays" BOOLEAN NOT NULL DEFAULT false;
