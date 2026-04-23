-- Add DISPATCHED value to ProjectStatus enum
-- Note: PostgreSQL ALTER TYPE to add enum value
ALTER TYPE "ProjectStatus" ADD VALUE IF NOT EXISTS 'DISPATCHED';

-- Add dispatchedAt and completionDays fields to Project table
ALTER TABLE "Project" ADD COLUMN IF NOT EXISTS "dispatchedAt" TIMESTAMP(3);
ALTER TABLE "Project" ADD COLUMN IF NOT EXISTS "completionDays" INTEGER;
