-- AlterTable
ALTER TABLE "Product" ADD COLUMN "size" TEXT;
ALTER TABLE "Product" ADD COLUMN "mrp" DECIMAL;
ALTER TABLE "Product" ADD COLUMN "reorderAt" INTEGER NOT NULL DEFAULT 5;
ALTER TABLE "Product" ADD COLUMN "galla" BOOLEAN NOT NULL DEFAULT true;

-- AlterTable
ALTER TABLE "Order" ADD COLUMN "fulfillmentStatus" TEXT NOT NULL DEFAULT 'pending';
ALTER TABLE "Order" ADD COLUMN "deliveryAssignee" TEXT;
ALTER TABLE "Order" ADD COLUMN "deliveryAddress" TEXT;
ALTER TABLE "Order" ADD COLUMN "deliveryNotes" TEXT;
ALTER TABLE "Order" ADD COLUMN "deliveryScheduledAt" DATETIME;
