import { PrismaClient } from "@prisma/client";
async function main() {
  const p = new PrismaClient();
  const seeds = await p.user.findMany({ where: { email: { endsWith: "@seed.yardapp.me" }, campus: "GCTU" }, select: { id: true } });
  const ids = seeds.map(s => s.id);
  console.log("SEED_GCTU_USERS=" + ids.length);
  if (ids.length === 0) { await p.$disconnect(); return; }
  const delC = await p.comment.deleteMany({ where: { OR: [{ userId: { in: ids } }, { post: { userId: { in: ids } } }] } });
  console.log("DEL_COMMENTS=" + delC.count);
  const posts = await p.post.findMany({ where: { userId: { in: ids } }, select: { id: true } });
  const pids = posts.map(x => x.id);
  console.log("SEED_POSTS=" + pids.length);
  await p.postHashtag.deleteMany({ where: { postId: { in: pids } } });
  const delP = await p.post.deleteMany({ where: { id: { in: pids } } });
  console.log("DEL_POSTS=" + delP.count);
  const delU = await p.user.deleteMany({ where: { id: { in: ids } } });
  console.log("DEL_USERS=" + delU.count);
  // rebuild GCTU hashtag stats from remaining posts
  const remaining = await p.postHashtag.count({ where: { post: { campus: "GCTU" } } });
  console.log("REMAIN_GCTU_LINKS=" + remaining);
  await p.$disconnect();
}
main().catch(e => { console.error(e); process.exit(1); });