-- Confession-of-the-day featured slot + AskQuestion table removal.
-- Additive + safe: app code try/catches COTD reads so the app works before
-- AND after deploy. Deploy with: npx prisma migrate deploy

-- COTD featured slot (set by /api/cron/daily-engagement §4, read by feed).
ALTER TABLE "Post" ADD COLUMN IF NOT EXISTS "isCOTD" BOOLEAN NOT NULL DEFAULT false;
ALTER TABLE "Post" ADD COLUMN IF NOT EXISTS "cotdDate" TIMESTAMP(3);
CREATE INDEX IF NOT EXISTS "Post_isCOTD_cotdDate_idx" ON "Post"("isCOTD", "cotdDate");

-- Ask-box retired: no code references AskQuestion (verified by grep), so the
-- table goes away with its constraints.
DROP TABLE IF EXISTS "AskQuestion";
