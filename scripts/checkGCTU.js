import { PrismaClient } from "@prisma/client";
async function main() {
  const p = new PrismaClient();
  console.log("GCTU_POSTS=" + await p.post.count({ where: { campus: "GCTU" } }));
  console.log("GCTU_USERS=" + await p.user.count({ where: { campus: "GCTU" } }));
  console.log("GCTU_TAGS=" + await p.hashtag.count({ where: { campus: "GCTU" } }));
  console.log("GCTU_COMMENTS=" + await p.comment.count({ where: { post: { campus: "GCTU" } } }));
  await p.$disconnect();
}
main();