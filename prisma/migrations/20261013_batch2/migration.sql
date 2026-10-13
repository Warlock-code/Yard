-- Monetization batch 2: additive tables only. Safe with zero downtime.
-- App code try/catches all reads/writes, so the app works before AND after
-- deploy. Deploy with: npx prisma migrate deploy

CREATE TABLE IF NOT EXISTS "ProfileView" (
  "id" TEXT NOT NULL,
  "viewerId" TEXT NOT NULL,
  "viewedId" TEXT NOT NULL,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "ProfileView_pkey" PRIMARY KEY ("id")
);
CREATE INDEX IF NOT EXISTS "ProfileView_viewedId_createdAt_idx" ON "ProfileView"("viewedId", "createdAt");
CREATE INDEX IF NOT EXISTS "ProfileView_viewerId_viewedId_createdAt_idx" ON "ProfileView"("viewerId", "viewedId", "createdAt");

CREATE TABLE IF NOT EXISTS "Poll" (
  "id" TEXT NOT NULL,
  "userId" TEXT NOT NULL,
  "campus" TEXT NOT NULL,
  "question" TEXT NOT NULL,
  "options" JSONB NOT NULL,
  "endsAt" TIMESTAMP(3) NOT NULL,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "Poll_pkey" PRIMARY KEY ("id")
);
CREATE INDEX IF NOT EXISTS "Poll_campus_createdAt_idx" ON "Poll"("campus", "createdAt");

CREATE TABLE IF NOT EXISTS "PollVote" (
  "id" TEXT NOT NULL,
  "pollId" TEXT NOT NULL,
  "userId" TEXT NOT NULL,
  "optionIdx" INTEGER NOT NULL,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "PollVote_pkey" PRIMARY KEY ("id"),
  CONSTRAINT "PollVote_pollId_fkey" FOREIGN KEY ("pollId") REFERENCES "Poll"("id") ON DELETE CASCADE ON UPDATE CASCADE
);
CREATE UNIQUE INDEX IF NOT EXISTS "PollVote_pollId_userId_key" ON "PollVote"("pollId", "userId");
CREATE INDEX IF NOT EXISTS "PollVote_pollId_idx" ON "PollVote"("pollId");

CREATE TABLE IF NOT EXISTS "ScheduledPost" (
  "id" TEXT NOT NULL,
  "userId" TEXT NOT NULL,
  "text" TEXT,
  "imageUrl" TEXT,
  "type" TEXT NOT NULL DEFAULT 'confession',
  "visibility" TEXT NOT NULL DEFAULT 'school',
  "campusTarget" TEXT,
  "runAt" TIMESTAMP(3) NOT NULL,
  "status" TEXT NOT NULL DEFAULT 'pending',
  "postIds" JSONB,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "ScheduledPost_pkey" PRIMARY KEY ("id")
);
CREATE INDEX IF NOT EXISTS "ScheduledPost_status_runAt_idx" ON "ScheduledPost"("status", "runAt");
CREATE INDEX IF NOT EXISTS "ScheduledPost_userId_status_idx" ON "ScheduledPost"("userId", "status");

CREATE TABLE IF NOT EXISTS "Reaction" (
  "id" TEXT NOT NULL,
  "postId" TEXT,
  "commentId" TEXT,
  "userId" TEXT NOT NULL,
  "emoji" TEXT NOT NULL,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "Reaction_pkey" PRIMARY KEY ("id")
);
CREATE INDEX IF NOT EXISTS "Reaction_postId_idx" ON "Reaction"("postId");
CREATE INDEX IF NOT EXISTS "Reaction_commentId_idx" ON "Reaction"("commentId");
CREATE INDEX IF NOT EXISTS "Reaction_userId_createdAt_idx" ON "Reaction"("userId", "createdAt");
