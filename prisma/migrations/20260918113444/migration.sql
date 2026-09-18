/*
  Warnings:

  - You are about to drop the column `pollOptions` on the `Post` table. All the data in the column will be lost.
  - You are about to drop the column `pollVotes` on the `Post` table. All the data in the column will be lost.
  - A unique constraint covering the columns `[providerTransferRef]` on the table `Payout` will be added. If there are existing duplicate values, this will fail.

*/
-- CreateEnum
CREATE TYPE "AccountStatus" AS ENUM ('ACTIVE', 'SUSPENDED', 'BANNED');

-- AlterTable
ALTER TABLE "Payout" ADD COLUMN     "providerTransferRef" TEXT;

-- AlterTable
ALTER TABLE "Post" DROP COLUMN "pollOptions",
DROP COLUMN "pollVotes";

-- AlterTable
ALTER TABLE "User" ADD COLUMN     "status" "AccountStatus" NOT NULL DEFAULT 'ACTIVE';

-- CreateTable
CREATE TABLE "RateLimit" (
    "id" TEXT NOT NULL,
    "key" TEXT NOT NULL,
    "hits" INTEGER NOT NULL DEFAULT 0,
    "windowStart" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "expiresAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "RateLimit_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "RateLimit_key_key" ON "RateLimit"("key");

-- CreateIndex
CREATE INDEX "RateLimit_expiresAt_idx" ON "RateLimit"("expiresAt");

-- CreateIndex
CREATE UNIQUE INDEX "Payout_providerTransferRef_key" ON "Payout"("providerTransferRef");
