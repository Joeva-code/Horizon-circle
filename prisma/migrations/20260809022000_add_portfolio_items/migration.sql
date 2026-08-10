-- CreateEnum
CREATE TYPE "PortfolioItem_mediaType" AS ENUM ('IMAGE', 'VIDEO');

-- AlterTable
ALTER TABLE "vendor_profiles" DROP COLUMN "portfolioImages";

-- CreateTable
CREATE TABLE "portfolio_items" (
    "id" TEXT NOT NULL,
    "vendorProfileId" TEXT NOT NULL,
    "mediaType" "PortfolioItem_mediaType" NOT NULL DEFAULT 'IMAGE',
    "url" TEXT NOT NULL,
    "thumbnailUrl" TEXT,
    "caption" TEXT,
    "description" TEXT,
    "priceRange" TEXT,
    "sortOrder" INTEGER NOT NULL DEFAULT 0,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "portfolio_items_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "portfolio_items_vendorProfileId_sortOrder_idx" ON "portfolio_items"("vendorProfileId", "sortOrder");

-- AddForeignKey
ALTER TABLE "portfolio_items" ADD CONSTRAINT "portfolio_items_vendorProfileId_fkey" FOREIGN KEY ("vendorProfileId") REFERENCES "vendor_profiles"("id") ON DELETE CASCADE ON UPDATE CASCADE;
