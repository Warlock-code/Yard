-- Manual native ads (Phase 1): sponsored posts authored via /api/admin/ads.
-- isAd marks ads out of normal feed ranking; adLink is the tap target.
-- AlterTable
ALTER TABLE "Post" ADD COLUMN     "adLink" TEXT,
ADD COLUMN     "isAd" BOOLEAN NOT NULL DEFAULT false;
