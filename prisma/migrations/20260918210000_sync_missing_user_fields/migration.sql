-- CreateEnum
CREATE TYPE "BattleType" AS ENUM ('SINGLE', 'BRACKET', 'RECURRING');

-- CreateEnum
CREATE TYPE "BattleStatus" AS ENUM ('UPCOMING', 'ACTIVE', 'VOTING', 'COMPLETED', 'CANCELLED');

-- CreateEnum
CREATE TYPE "BattleEntryType" AS ENUM ('TEXT', 'IMAGE', 'VOICE');

-- DropIndex
DROP INDEX "Post_searchVector_idx";

-- AlterTable
ALTER TABLE "BattleEntry" ADD COLUMN     "entryType" "BattleEntryType" NOT NULL DEFAULT 'TEXT',
ADD COLUMN     "imageUrl" TEXT,
ADD COLUMN     "roundNumber" INTEGER NOT NULL DEFAULT 1,
ADD COLUMN     "updatedAt" TIMESTAMP(3) NOT NULL,
ADD COLUMN     "voiceUrl" TEXT,
ADD COLUMN     "wonRound" BOOLEAN NOT NULL DEFAULT false,
ALTER COLUMN "text" DROP NOT NULL;

-- AlterTable
ALTER TABLE "BattlePrompt" ADD COLUMN     "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
ADD COLUMN     "earlyAccessForPrime" BOOLEAN NOT NULL DEFAULT false,
ADD COLUMN     "entryType" "BattleEntryType" NOT NULL DEFAULT 'TEXT',
ADD COLUMN     "isPrimeOnly" BOOLEAN NOT NULL DEFAULT false,
ADD COLUMN     "parentPromptId" TEXT,
ADD COLUMN     "roundNumber" INTEGER NOT NULL DEFAULT 1,
ADD COLUMN     "seasonId" TEXT,
ADD COLUMN     "status" "BattleStatus" NOT NULL DEFAULT 'UPCOMING',
ADD COLUMN     "totalRounds" INTEGER NOT NULL DEFAULT 1,
ADD COLUMN     "type" "BattleType" NOT NULL DEFAULT 'SINGLE',
ADD COLUMN     "updatedAt" TIMESTAMP(3) NOT NULL,
ADD COLUMN     "winnerEntryId" TEXT;

-- AlterTable
ALTER TABLE "Post" DROP COLUMN "searchVector";

-- AlterTable
ALTER TABLE "User" ADD COLUMN     "inviteCode" TEXT NOT NULL,
ADD COLUMN     "referralCount" INTEGER NOT NULL DEFAULT 0,
ADD COLUMN     "referredBy" TEXT;

-- CreateTable
CREATE TABLE "BattleSeason" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "campus" TEXT NOT NULL,
    "startDate" TIMESTAMP(3) NOT NULL,
    "endDate" TIMESTAMP(3) NOT NULL,
    "isActive" BOOLEAN NOT NULL DEFAULT false,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "BattleSeason_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "PostView" (
    "id" TEXT NOT NULL,
    "postId" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "PostView_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Referral" (
    "id" TEXT NOT NULL,
    "referrerId" TEXT NOT NULL,
    "referredId" TEXT NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'pending',
    "rewardAmount" INTEGER NOT NULL DEFAULT 0,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "completedAt" TIMESTAMP(3),

    CONSTRAINT "Referral_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "BattleStats" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "totalBattles" INTEGER NOT NULL DEFAULT 0,
    "totalEntries" INTEGER NOT NULL DEFAULT 0,
    "totalWins" INTEGER NOT NULL DEFAULT 0,
    "totalVotes" INTEGER NOT NULL DEFAULT 0,
    "winRate" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "currentStreak" INTEGER NOT NULL DEFAULT 0,
    "bestStreak" INTEGER NOT NULL DEFAULT 0,
    "lastBattleAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "BattleStats_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "BattleSeason_campus_isActive_idx" ON "BattleSeason"("campus", "isActive");

-- CreateIndex
CREATE INDEX "PostView_postId_createdAt_idx" ON "PostView"("postId", "createdAt");

-- CreateIndex
CREATE INDEX "PostView_userId_createdAt_idx" ON "PostView"("userId", "createdAt");

-- CreateIndex
CREATE UNIQUE INDEX "PostView_postId_userId_key" ON "PostView"("postId", "userId");

-- CreateIndex
CREATE UNIQUE INDEX "Referral_referredId_key" ON "Referral"("referredId");

-- CreateIndex
CREATE INDEX "Referral_referrerId_status_idx" ON "Referral"("referrerId", "status");

-- CreateIndex
CREATE INDEX "Referral_referredId_idx" ON "Referral"("referredId");

-- CreateIndex
CREATE UNIQUE INDEX "BattleStats_userId_key" ON "BattleStats"("userId");

-- CreateIndex
CREATE INDEX "BattleStats_userId_idx" ON "BattleStats"("userId");

-- CreateIndex
CREATE INDEX "BattleEntry_promptId_roundNumber_idx" ON "BattleEntry"("promptId", "roundNumber");

-- CreateIndex
CREATE INDEX "BattlePrompt_campus_active_status_idx" ON "BattlePrompt"("campus", "active", "status");

-- CreateIndex
CREATE INDEX "BattlePrompt_campus_startsAt_idx" ON "BattlePrompt"("campus", "startsAt");

-- CreateIndex
CREATE INDEX "BattlePrompt_seasonId_idx" ON "BattlePrompt"("seasonId");

-- CreateIndex
CREATE INDEX "BattlePrompt_parentPromptId_idx" ON "BattlePrompt"("parentPromptId");

-- CreateIndex
CREATE UNIQUE INDEX "User_inviteCode_key" ON "User"("inviteCode");

-- AddForeignKey
ALTER TABLE "BattlePrompt" ADD CONSTRAINT "BattlePrompt_seasonId_fkey" FOREIGN KEY ("seasonId") REFERENCES "BattleSeason"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "BattlePrompt" ADD CONSTRAINT "BattlePrompt_parentPromptId_fkey" FOREIGN KEY ("parentPromptId") REFERENCES "BattlePrompt"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "BattlePrompt" ADD CONSTRAINT "BattlePrompt_winnerEntryId_fkey" FOREIGN KEY ("winnerEntryId") REFERENCES "BattleEntry"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Referral" ADD CONSTRAINT "Referral_referrerId_fkey" FOREIGN KEY ("referrerId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Referral" ADD CONSTRAINT "Referral_referredId_fkey" FOREIGN KEY ("referredId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "BattleStats" ADD CONSTRAINT "BattleStats_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

