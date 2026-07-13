-- CreateEnum
CREATE TYPE "TeamCountryPolicyMode" AS ENUM ('INHERIT', 'ALLOW_LIST');

-- CreateTable
CREATE TABLE "Country" (
    "code" TEXT NOT NULL,
    "nameZh" TEXT NOT NULL,
    "nameEn" TEXT NOT NULL,
    "emoji" TEXT,
    "enabled" BOOLEAN NOT NULL DEFAULT true,
    "sortOrder" INTEGER NOT NULL DEFAULT 0,

    CONSTRAINT "Country_pkey" PRIMARY KEY ("code")
);

-- CreateTable
CREATE TABLE "CompanyCountry" (
    "companyId" TEXT NOT NULL,
    "countryCode" TEXT NOT NULL,

    CONSTRAINT "CompanyCountry_pkey" PRIMARY KEY ("companyId","countryCode")
);

-- CreateTable
CREATE TABLE "TeamCountry" (
    "teamId" TEXT NOT NULL,
    "countryCode" TEXT NOT NULL,

    CONSTRAINT "TeamCountry_pkey" PRIMARY KEY ("teamId","countryCode")
);

-- AlterTable
ALTER TABLE "Team" ADD COLUMN "countryPolicyMode" "TeamCountryPolicyMode" NOT NULL DEFAULT 'INHERIT';

-- AlterTable
ALTER TABLE "Order" ADD COLUMN "teamId" TEXT;

-- CreateIndex
CREATE INDEX "CompanyCountry_companyId_idx" ON "CompanyCountry"("companyId");

-- CreateIndex
CREATE INDEX "TeamCountry_teamId_idx" ON "TeamCountry"("teamId");

-- CreateIndex
CREATE INDEX "Order_teamId_idx" ON "Order"("teamId");

-- AddForeignKey
ALTER TABLE "CompanyCountry" ADD CONSTRAINT "CompanyCountry_companyId_fkey" FOREIGN KEY ("companyId") REFERENCES "Company"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "CompanyCountry" ADD CONSTRAINT "CompanyCountry_countryCode_fkey" FOREIGN KEY ("countryCode") REFERENCES "Country"("code") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "TeamCountry" ADD CONSTRAINT "TeamCountry_teamId_fkey" FOREIGN KEY ("teamId") REFERENCES "Team"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "TeamCountry" ADD CONSTRAINT "TeamCountry_countryCode_fkey" FOREIGN KEY ("countryCode") REFERENCES "Country"("code") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Order" ADD CONSTRAINT "Order_teamId_fkey" FOREIGN KEY ("teamId") REFERENCES "Team"("id") ON DELETE SET NULL ON UPDATE CASCADE;
