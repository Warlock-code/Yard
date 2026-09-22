-- Baseline: objects applied to the database directly (via db push / direct SQL)
-- before migration history caught up. Recorded with
-- `prisma migrate resolve --applied` — never executed against the DB.
-- Covers drift detected 2026-09-22: CommentVote table, Comment.yeahs,
-- User.freeBoostsWeekly, User.freeStreakFreezeMonthly,
-- User.lastFreeBoostGrant, User.lastFreeFreezeGrant,
-- User.resetToken, User.resetTokenExpiry (+ unique index).

-- CreateTable
CREATE TABLE "CommentVote" (
    "id" TEXT NOT NULL,
    "commentId" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "CommentVote_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "CommentVote_commentId_idx" ON "CommentVote"("commentId");

-- CreateIndex
CREATE UNIQUE INDEX "CommentVote_commentId_userId_key" ON "CommentVote"("commentId", "userId");

-- AddForeignKey
ALTER TABLE "CommentVote" ADD CONSTRAINT "CommentVote_commentId_fkey" FOREIGN KEY ("commentId") REFERENCES "Comment"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AlterTable
ALTER TABLE "Comment" ADD COLUMN "yeahs" INTEGER NOT NULL DEFAULT 0;

-- AlterTable
ALTER TABLE "User" ADD COLUMN "freeBoostsWeekly" INTEGER NOT NULL DEFAULT 0;

-- AlterTable
ALTER TABLE "User" ADD COLUMN "freeStreakFreezeMonthly" INTEGER NOT NULL DEFAULT 0;

-- AlterTable
ALTER TABLE "User" ADD COLUMN "lastFreeBoostGrant" TIMESTAMP(3);

-- AlterTable
ALTER TABLE "User" ADD COLUMN "lastFreeFreezeGrant" TIMESTAMP(3);

-- AlterTable
ALTER TABLE "User" ADD COLUMN "resetToken" TEXT;

-- AlterTable
ALTER TABLE "User" ADD COLUMN "resetTokenExpiry" TIMESTAMP(3);

-- CreateIndex
CREATE UNIQUE INDEX "User_resetToken_key" ON "User"("resetToken");
