-- Keep moderation records after the reported post is removed.
ALTER TABLE "Report" DROP CONSTRAINT "Report_postId_fkey";
ALTER TABLE "Report" ADD CONSTRAINT "Report_postId_fkey" FOREIGN KEY ("postId") REFERENCES "Post"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- A person can submit one report per post and one entry per battle.
CREATE UNIQUE INDEX "Report_postId_reporterId_key" ON "Report"("postId", "reporterId");
CREATE UNIQUE INDEX "BattleEntry_promptId_userId_key" ON "BattleEntry"("promptId", "userId");
