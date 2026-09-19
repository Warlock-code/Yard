import { PrismaClient } from "@prisma/client";
async function main() {
  const p = new PrismaClient();
  const tags = await p.hashtag.findMany({ where: { campus: "GCTU" }, orderBy: { postsCount: "desc" }, take: 12, select: { tag: true, postsCount: true } });
  for (const t of tags) console.log(t.tag + " -> " + t.postsCount);
  await p.$disconnect();
}
main();