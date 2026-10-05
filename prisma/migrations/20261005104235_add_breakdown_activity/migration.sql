-- CreateTable
CREATE TABLE "breakdown_activity" (
    "id" UUID NOT NULL,
    "breakdownId" UUID NOT NULL,
    "userId" UUID NOT NULL,
    "kind" TEXT NOT NULL,
    "productCode" TEXT,
    "productName" TEXT,
    "summary" TEXT NOT NULL,
    "details" JSONB,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "breakdown_activity_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "breakdown_activity_breakdownId_createdAt_idx" ON "breakdown_activity"("breakdownId", "createdAt");

-- AddForeignKey
ALTER TABLE "breakdown_activity" ADD CONSTRAINT "breakdown_activity_breakdownId_fkey" FOREIGN KEY ("breakdownId") REFERENCES "breakdowns"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "breakdown_activity" ADD CONSTRAINT "breakdown_activity_userId_fkey" FOREIGN KEY ("userId") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;
