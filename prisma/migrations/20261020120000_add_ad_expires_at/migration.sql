-- Ad campaign expiry: feed queries hide ads once this timestamp passes.
-- NULL keeps legacy ads live indefinitely.
ALTER TABLE "Post" ADD COLUMN     "adExpiresAt" TIMESTAMP(3);
