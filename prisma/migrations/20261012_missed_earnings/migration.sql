-- Missed-earnings shadow counter for FREE users (upgrade nudge).
-- Purely additive: safe with zero downtime. App code try/catches all
-- missedEarnings reads/writes, so the app works before AND after deploy.
-- Deploy with: npx prisma migrate deploy

ALTER TABLE "User" ADD COLUMN IF NOT EXISTS "missedEarnings" INTEGER NOT NULL DEFAULT 0;
ALTER TABLE "User" ADD COLUMN IF NOT EXISTS "missedEarningsAt" TIMESTAMP(3);
