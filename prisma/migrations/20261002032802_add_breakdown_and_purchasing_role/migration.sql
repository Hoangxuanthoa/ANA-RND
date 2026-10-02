-- AlterEnum
ALTER TYPE "Role" ADD VALUE 'PURCHASING';

-- CreateTable
CREATE TABLE "breakdowns" (
    "id" UUID NOT NULL,
    "name" TEXT NOT NULL,
    "createdById" UUID NOT NULL,
    "activeProductId" UUID,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "breakdowns_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "breakdown_products" (
    "id" UUID NOT NULL,
    "breakdownId" UUID NOT NULL,
    "code" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "sortOrder" INTEGER NOT NULL DEFAULT 0,
    "data" JSONB NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "breakdown_products_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "breakdown_products_breakdownId_code_key" ON "breakdown_products"("breakdownId", "code");

-- AddForeignKey
ALTER TABLE "breakdowns" ADD CONSTRAINT "breakdowns_createdById_fkey" FOREIGN KEY ("createdById") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "breakdown_products" ADD CONSTRAINT "breakdown_products_breakdownId_fkey" FOREIGN KEY ("breakdownId") REFERENCES "breakdowns"("id") ON DELETE CASCADE ON UPDATE CASCADE;
