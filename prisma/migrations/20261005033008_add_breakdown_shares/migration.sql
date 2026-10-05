-- CreateTable
CREATE TABLE "breakdown_shares" (
    "id" UUID NOT NULL,
    "breakdownId" UUID NOT NULL,
    "userId" UUID NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "breakdown_shares_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "breakdown_shares_breakdownId_userId_key" ON "breakdown_shares"("breakdownId", "userId");

-- AddForeignKey
ALTER TABLE "breakdown_shares" ADD CONSTRAINT "breakdown_shares_breakdownId_fkey" FOREIGN KEY ("breakdownId") REFERENCES "breakdowns"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "breakdown_shares" ADD CONSTRAINT "breakdown_shares_userId_fkey" FOREIGN KEY ("userId") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;
