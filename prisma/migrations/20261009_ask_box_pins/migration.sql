-- Ask-box (NGL-style anonymous questions) + campus post pins.
-- Purely additive: safe to deploy with zero downtime. App code try/catches
-- all AskQuestion reads/writes and pinned-post queries, so the app works
-- before AND after this migration.
-- Deploy with: npx prisma migrate deploy

CREATE TABLE IF NOT EXISTS "AskQuestion" (
  "id" TEXT NOT NULL,
  "recipientId" TEXT NOT NULL,
  "text" TEXT NOT NULL,
  "senderId" TEXT,
  "status" TEXT NOT NULL DEFAULT 'pending',
  "answer" TEXT,
  "answerPostId" TEXT,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "AskQuestion_pkey" PRIMARY KEY ("id")
);

CREATE INDEX IF NOT EXISTS "AskQuestion_recipientId_status_createdAt_idx"
  ON "AskQuestion"("recipientId", "status", "createdAt");

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.table_constraints
    WHERE constraint_name = 'AskQuestion_recipientId_fkey'
  ) THEN
    ALTER TABLE "AskQuestion" ADD CONSTRAINT "AskQuestion_recipientId_fkey"
      FOREIGN KEY ("recipientId") REFERENCES "User"("id")
      ON DELETE CASCADE ON UPDATE CASCADE;
  END IF;
END $$;

ALTER TABLE "Post" ADD COLUMN IF NOT EXISTS "pinnedUntil" TIMESTAMP(3);
