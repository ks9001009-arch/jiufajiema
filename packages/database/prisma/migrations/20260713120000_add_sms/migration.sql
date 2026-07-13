-- CreateEnum
CREATE TYPE "SmsStatus" AS ENUM ('RECEIVED', 'FAILED');

-- CreateTable
CREATE TABLE "Sms" (
    "id" TEXT NOT NULL,
    "orderId" TEXT NOT NULL,
    "code" TEXT,
    "content" TEXT,
    "status" "SmsStatus" NOT NULL DEFAULT 'RECEIVED',
    "receivedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "Sms_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "Sms_orderId_idx" ON "Sms"("orderId");

-- AddForeignKey
ALTER TABLE "Sms" ADD CONSTRAINT "Sms_orderId_fkey" FOREIGN KEY ("orderId") REFERENCES "Order"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
