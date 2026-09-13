-- AlterTable
ALTER TABLE "User" ADD COLUMN     "lastStreakCount" INTEGER,
ADD COLUMN     "streakBrokenAt" TIMESTAMP(3);
