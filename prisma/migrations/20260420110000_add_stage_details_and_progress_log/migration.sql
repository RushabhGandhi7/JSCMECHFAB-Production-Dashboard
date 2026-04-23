-- AlterTable: Add stageDetails JSON column to ProjectStage
ALTER TABLE "ProjectStage" ADD COLUMN "stageDetails" JSONB;

-- CreateTable: StageProgressLog for immutable audit trail
CREATE TABLE "StageProgressLog" (
    "id" TEXT NOT NULL,
    "projectId" TEXT NOT NULL,
    "projectStageId" TEXT NOT NULL,
    "stageName" TEXT NOT NULL,
    "field" TEXT NOT NULL,
    "previousValue" TEXT,
    "newValue" TEXT,
    "updatedBy" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "StageProgressLog_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "StageProgressLog_projectId_idx" ON "StageProgressLog"("projectId");
CREATE INDEX "StageProgressLog_projectStageId_idx" ON "StageProgressLog"("projectStageId");
CREATE INDEX "StageProgressLog_createdAt_idx" ON "StageProgressLog"("createdAt");

-- AddForeignKey
ALTER TABLE "StageProgressLog" ADD CONSTRAINT "StageProgressLog_projectId_fkey" FOREIGN KEY ("projectId") REFERENCES "Project"("id") ON DELETE CASCADE ON UPDATE CASCADE;
