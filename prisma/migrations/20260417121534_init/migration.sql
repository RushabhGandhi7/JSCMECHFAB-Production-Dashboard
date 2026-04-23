-- CreateEnum
CREATE TYPE "ProjectStatus" AS ENUM ('PLANNING', 'IN_PRODUCTION', 'COMPLETED', 'DELAYED');

-- CreateEnum
CREATE TYPE "DeliveryStatus" AS ENUM ('PENDING', 'ORDERED', 'IN_TRANSIT', 'RECEIVED');

-- CreateEnum
CREATE TYPE "DrawingStatus" AS ENUM ('NOT_STARTED', 'IN_PROGRESS', 'RELEASED', 'APPROVED');

-- CreateEnum
CREATE TYPE "StageStatus" AS ENUM ('NOT_STARTED', 'IN_PROGRESS', 'COMPLETED');

-- CreateEnum
CREATE TYPE "UserRole" AS ENUM ('ADMIN', 'VIEWER');

-- CreateTable
CREATE TABLE "User" (
    "id" TEXT NOT NULL,
    "email" TEXT NOT NULL,
    "passwordHash" TEXT NOT NULL,
    "role" "UserRole" NOT NULL DEFAULT 'VIEWER',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "User_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Project" (
    "id" TEXT NOT NULL,
    "projectNo" TEXT NOT NULL,
    "clientName" TEXT NOT NULL,
    "equipmentType" TEXT NOT NULL,
    "orderDate" TIMESTAMP(3) NOT NULL,
    "deliveryDate" TIMESTAMP(3) NOT NULL,
    "status" "ProjectStatus" NOT NULL DEFAULT 'PLANNING',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Project_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "DBOItem" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,

    CONSTRAINT "DBOItem_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ProjectDBO" (
    "id" TEXT NOT NULL,
    "projectId" TEXT NOT NULL,
    "dboItemId" TEXT NOT NULL,
    "deliveryStatus" "DeliveryStatus" NOT NULL DEFAULT 'PENDING',
    "componentNo" TEXT,
    "dateReceived" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "ProjectDBO_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "DrawingItem" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,

    CONSTRAINT "DrawingItem_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ProjectDrawing" (
    "id" TEXT NOT NULL,
    "projectId" TEXT NOT NULL,
    "drawingItemId" TEXT NOT NULL,
    "drawingStatus" "DrawingStatus" NOT NULL DEFAULT 'NOT_STARTED',
    "revisionNo" INTEGER NOT NULL DEFAULT 0,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "ProjectDrawing_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ProductionStage" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "weight" DOUBLE PRECISION NOT NULL,

    CONSTRAINT "ProductionStage_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ProjectStage" (
    "id" TEXT NOT NULL,
    "projectId" TEXT NOT NULL,
    "stageId" TEXT NOT NULL,
    "status" "StageStatus" NOT NULL DEFAULT 'NOT_STARTED',
    "progress" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "plannedDate" TIMESTAMP(3),
    "actualDate" TIMESTAMP(3),
    "delayReason" TEXT,
    "isDelayed" BOOLEAN NOT NULL DEFAULT false,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "ProjectStage_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ActivityLog" (
    "id" TEXT NOT NULL,
    "projectId" TEXT NOT NULL,
    "action" TEXT NOT NULL,
    "entity" TEXT NOT NULL,
    "entityId" TEXT,
    "details" JSONB,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "ActivityLog_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "User_email_key" ON "User"("email");

-- CreateIndex
CREATE UNIQUE INDEX "Project_projectNo_key" ON "Project"("projectNo");

-- CreateIndex
CREATE INDEX "Project_status_idx" ON "Project"("status");

-- CreateIndex
CREATE UNIQUE INDEX "DBOItem_name_key" ON "DBOItem"("name");

-- CreateIndex
CREATE INDEX "ProjectDBO_projectId_idx" ON "ProjectDBO"("projectId");

-- CreateIndex
CREATE INDEX "ProjectDBO_deliveryStatus_idx" ON "ProjectDBO"("deliveryStatus");

-- CreateIndex
CREATE UNIQUE INDEX "ProjectDBO_projectId_dboItemId_key" ON "ProjectDBO"("projectId", "dboItemId");

-- CreateIndex
CREATE UNIQUE INDEX "DrawingItem_name_key" ON "DrawingItem"("name");

-- CreateIndex
CREATE INDEX "ProjectDrawing_projectId_idx" ON "ProjectDrawing"("projectId");

-- CreateIndex
CREATE INDEX "ProjectDrawing_drawingStatus_idx" ON "ProjectDrawing"("drawingStatus");

-- CreateIndex
CREATE UNIQUE INDEX "ProjectDrawing_projectId_drawingItemId_key" ON "ProjectDrawing"("projectId", "drawingItemId");

-- CreateIndex
CREATE UNIQUE INDEX "ProductionStage_name_key" ON "ProductionStage"("name");

-- CreateIndex
CREATE INDEX "ProjectStage_projectId_idx" ON "ProjectStage"("projectId");

-- CreateIndex
CREATE INDEX "ProjectStage_status_idx" ON "ProjectStage"("status");

-- CreateIndex
CREATE UNIQUE INDEX "ProjectStage_projectId_stageId_key" ON "ProjectStage"("projectId", "stageId");

-- CreateIndex
CREATE INDEX "ActivityLog_projectId_idx" ON "ActivityLog"("projectId");

-- CreateIndex
CREATE INDEX "ActivityLog_action_idx" ON "ActivityLog"("action");

-- AddForeignKey
ALTER TABLE "ProjectDBO" ADD CONSTRAINT "ProjectDBO_projectId_fkey" FOREIGN KEY ("projectId") REFERENCES "Project"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ProjectDBO" ADD CONSTRAINT "ProjectDBO_dboItemId_fkey" FOREIGN KEY ("dboItemId") REFERENCES "DBOItem"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ProjectDrawing" ADD CONSTRAINT "ProjectDrawing_projectId_fkey" FOREIGN KEY ("projectId") REFERENCES "Project"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ProjectDrawing" ADD CONSTRAINT "ProjectDrawing_drawingItemId_fkey" FOREIGN KEY ("drawingItemId") REFERENCES "DrawingItem"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ProjectStage" ADD CONSTRAINT "ProjectStage_projectId_fkey" FOREIGN KEY ("projectId") REFERENCES "Project"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ProjectStage" ADD CONSTRAINT "ProjectStage_stageId_fkey" FOREIGN KEY ("stageId") REFERENCES "ProductionStage"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ActivityLog" ADD CONSTRAINT "ActivityLog_projectId_fkey" FOREIGN KEY ("projectId") REFERENCES "Project"("id") ON DELETE CASCADE ON UPDATE CASCADE;
