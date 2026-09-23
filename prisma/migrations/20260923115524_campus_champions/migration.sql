-- CreateTable
CREATE TABLE "CampusChampion" (
    "campus" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "wonAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "CampusChampion_pkey" PRIMARY KEY ("campus")
);

-- CreateTable
CREATE TABLE "CampusBattleWin" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "campus" TEXT NOT NULL,
    "wins" INTEGER NOT NULL DEFAULT 1,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "CampusBattleWin_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "CampusChampion_userId_idx" ON "CampusChampion"("userId");

-- CreateIndex
CREATE INDEX "CampusBattleWin_campus_wins_idx" ON "CampusBattleWin"("campus", "wins");

-- CreateIndex
CREATE UNIQUE INDEX "CampusBattleWin_userId_campus_key" ON "CampusBattleWin"("userId", "campus");

-- AddForeignKey
ALTER TABLE "CampusChampion" ADD CONSTRAINT "CampusChampion_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "CampusBattleWin" ADD CONSTRAINT "CampusBattleWin_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;
