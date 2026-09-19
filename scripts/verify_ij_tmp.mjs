import { PrismaClient } from "@prisma/client";
import { readFileSync } from "fs";
const prisma = new PrismaClient();
const I = JSON.parse(readFileSync("gctu-chunk-I.json", "utf8"));
const J = JSON.parse(readFileSync("gctu-chunk-J.json", "utf8"));
const picks = [{ label: "I[0]", pol: I[0] }, { label: "J[77]", pol: J[77] }];
const pidginRe = /\b(dey|e go|na you|no dey|wahala|chaw|herh|ehn|sef|wey|them dey)\b/i;
for (const { label, pol } of picks) {
  const posts = await prisma.post.findMany({
    where: { campus: "GCTU", user: { ghostId: pol.authorGhost } },
    include: { comments: { orderBy: { createdAt: "asc" } }, hashtags: true },
  });
  console.log(`=== ${label} ghost=${pol.authorGhost} dbPosts=${posts.length}`);
  for (const p of posts) {
    console.log(`textMatch=${p.text === pol.text}`);
    if (p.text !== pol.text) {
      console.log("DB:", p.text?.slice(0, 300));
      console.log("EXP:", pol.text.slice(0, 300));
    }
    console.log(`yeahs=${p.yeahs} exp=${pol.yeahs} match=${p.yeahs === pol.yeahs}`);
    console.log(`boosted=${p.boosted} exp=${!!pol.boosted}`);
    console.log(`commentsCount field=${p.commentsCount} actual=${p.comments.length} exp=${(pol.comments || []).length} match=${p.comments.length === (pol.comments || []).length}`);
    const dbTexts = p.comments.map((c) => c.text);
    const expTexts = (pol.comments || []).map((c) => c.text);
    console.log(`commentsOrderMatch=${JSON.stringify(dbTexts) === JSON.stringify(expTexts)}`);
    if (JSON.stringify(dbTexts) !== JSON.stringify(expTexts)) {
      console.log("DB comments:", dbTexts.slice(0, 3));
      console.log("EXP comments:", expTexts.slice(0, 3));
    }
    const allText = p.text + " " + dbTexts.join(" ");
    const m = allText.match(pidginRe);
    console.log(`pidginFound=${m ? m[0] : "none"}`);
    console.log(`hashtagsLinks=${p.hashtags.length}`);
    console.log(`createdAt=${p.createdAt.toISOString()}`);
  }
}
await prisma.$disconnect();
