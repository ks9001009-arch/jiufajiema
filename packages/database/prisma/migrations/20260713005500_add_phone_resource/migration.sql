-- CreateEnum
CREATE TYPE "PhoneStatus" AS ENUM ('AVAILABLE', 'LOCKED', 'USED', 'EXPIRED', 'DISABLED');

-- CreateTable
CREATE TABLE "PhoneResource" (
    "id" TEXT NOT NULL,
    "companyId" TEXT NOT NULL,
    "providerId" TEXT NOT NULL,
    "phone" TEXT NOT NULL,
    "country" TEXT,
    "status" "PhoneStatus" NOT NULL DEFAULT 'AVAILABLE',
    "cost" DECIMAL(10,4) NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "PhoneResource_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "PhoneResource_companyId_phone_key" ON "PhoneResource"("companyId", "phone");

-- CreateIndex
CREATE INDEX "PhoneResource_companyId_idx" ON "PhoneResource"("companyId");

-- CreateIndex
CREATE INDEX "PhoneResource_providerId_idx" ON "PhoneResource"("providerId");

-- CreateIndex
CREATE INDEX "PhoneResource_status_idx" ON "PhoneResource"("status");

-- AddForeignKey
ALTER TABLE "PhoneResource" ADD CONSTRAINT "PhoneResource_companyId_fkey" FOREIGN KEY ("companyId") REFERENCES "Company"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "PhoneResource" ADD CONSTRAINT "PhoneResource_providerId_fkey" FOREIGN KEY ("providerId") REFERENCES "Provider"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
