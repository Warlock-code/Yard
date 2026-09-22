-- CreateTable
CREATE TABLE "PaywallHit" (
    "id" TEXT NOT NULL,
    "userId" TEXT,
    "feature" TEXT NOT NULL,
    "pathname" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "PaywallHit_pkey" PRIMARY KEY ("id")
);
-- CreateIndex
CREATE INDEX "PaywallHit_feature_createdAt_idx" ON "PaywallHit"("feature", "createdAt");
-- CreateIndex
CREATE INDEX "PaywallHit_createdAt_idx" ON "PaywallHit"("createdAt");
