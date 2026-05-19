-- AlterTable
ALTER TABLE "Order" ADD COLUMN     "taxDeferralRequested" BOOLEAN NOT NULL DEFAULT false;

-- AlterTable
ALTER TABLE "User" ADD COLUMN     "resellerLicenseUploadedAt" TIMESTAMP(3),
ADD COLUMN     "resellerLicenseUrl" TEXT;
