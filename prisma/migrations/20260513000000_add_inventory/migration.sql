-- Add InventoryAction enum
CREATE TYPE "InventoryAction" AS ENUM ('STOCK_IN', 'ISSUED_TO_PROJECT', 'ADJUSTMENT');

-- Add addedToInventory column to ProcurementItem
ALTER TABLE "ProcurementItem" ADD COLUMN "addedToInventory" BOOLEAN NOT NULL DEFAULT false;

-- Create InventoryItem table
CREATE TABLE "InventoryItem" (
    "id"            TEXT NOT NULL,
    "itemName"      TEXT NOT NULL,
    "category"      "ProcurementCategory" NOT NULL,
    "materialType"  TEXT NOT NULL DEFAULT 'MS',
    "thickness"     DOUBLE PRECISION,
    "dimensions"    TEXT,
    "unit"          TEXT NOT NULL DEFAULT 'pcs',
    "currentStock"  DOUBLE PRECISION NOT NULL DEFAULT 0,
    "weightPerUnit" DOUBLE PRECISION,
    "totalWeight"   DOUBLE PRECISION,
    "rackLocation"  TEXT,
    "lowStockLevel" DOUBLE PRECISION NOT NULL DEFAULT 5,
    "createdAt"     TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt"     TIMESTAMP(3) NOT NULL,

    CONSTRAINT "InventoryItem_pkey" PRIMARY KEY ("id")
);

-- Create InventoryTransaction table
CREATE TABLE "InventoryTransaction" (
    "id"          TEXT NOT NULL,
    "itemId"      TEXT NOT NULL,
    "action"      "InventoryAction" NOT NULL,
    "quantity"    DOUBLE PRECISION NOT NULL,
    "projectId"   TEXT,
    "procItemId"  TEXT,
    "remarks"     TEXT,
    "updatedBy"   TEXT NOT NULL,
    "createdAt"   TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "InventoryTransaction_pkey" PRIMARY KEY ("id")
);

-- Add indexes for InventoryItem
CREATE INDEX "InventoryItem_category_idx" ON "InventoryItem"("category");

-- Add indexes for InventoryTransaction
CREATE INDEX "InventoryTransaction_itemId_idx" ON "InventoryTransaction"("itemId");
CREATE INDEX "InventoryTransaction_projectId_idx" ON "InventoryTransaction"("projectId");
CREATE INDEX "InventoryTransaction_createdAt_idx" ON "InventoryTransaction"("createdAt");

-- Add foreign key from InventoryTransaction to InventoryItem
ALTER TABLE "InventoryTransaction" ADD CONSTRAINT "InventoryTransaction_itemId_fkey"
    FOREIGN KEY ("itemId") REFERENCES "InventoryItem"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- Add foreign key from InventoryTransaction to Project (nullable)
ALTER TABLE "InventoryTransaction" ADD CONSTRAINT "InventoryTransaction_projectId_fkey"
    FOREIGN KEY ("projectId") REFERENCES "Project"("id") ON DELETE SET NULL ON UPDATE CASCADE;
