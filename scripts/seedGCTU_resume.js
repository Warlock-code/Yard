import { PrismaClient } from "@prisma/client"
import { readFileSync } from "fs"
import { join } from "path"
const prisma = new PrismaClient()
const FILES = ["gctu-chunk-E.json","gctu-chunk-F.json","gctu-chunk-G.json","gctu-chunk-H.json","gctu-chunk-I.json","gctu-chunk-J.json"]
const START = parseInt(process.argv[2] || "175")
const CONCURRENCY = 5
const sleep = (ms) => new Promise(r => setTimeout(r, ms))
async function withRetry(fn, tries=6) {
  let last
  for (let i=0;i<tries;i++) {
    try { return await fn() } catch(e) { last=e; console.log(`RETRY ${i+1} err=${e.code||e.message}`); await sleep(1500*(i+1)) }
  }
  throw last
}
async function seedOne(p, userByGhost) {
  const author = userByGhost.get(p.authorGhost)
  if (!author) return { posts: 0, comments: 0 }
  const createdAt = new Date(Date.now() - Math.floor(Math.random() * 14 * 24 * 60 * 60 * 1000))
  const post = await withRetry(() => prisma.post.create({
    data: { userId: author.id, text: p.text,
      type: ["confession","gossip","meme"].includes(p.type) ? p.type : "confession",
      campus: "GCTU", visibility: "school",
      yeahs: typeof p.yeahs === "number" ? p.yeahs : 0,
      boosted: !!p.boosted,
      boostedUntil: p.boosted ? new Date(Date.now() + 7*24*60*60*1000) : null,
      createdAt }
  }))
  const tags = [...new Set([...p.text.matchAll(/#(\w+)/g)].map(m => m[1].toLowerCase()))]
  for (const tag of tags) {
    const hashtag = await withRetry(() => prisma.hashtag.upsert({
      where: { tag },
      update: { postsCount: { increment: 1 }, lastUsedAt: new Date(), trendingScore: { increment: p.boosted ? 5 : 1 } },
      create: { tag, campus: "GCTU", postsCount: 1, trendingScore: p.boosted ? 10 : 1 },
    })).catch(() => null)
    if (hashtag) await prisma.postHashtag.create({ data: { postId: post.id, hashtagId: hashtag.id } }).catch(() => {})
  }
  const rows = (p.comments || []).map(c => {
    const u = userByGhost.get(c.ghostId) || author
    const at = new Date(createdAt.getTime() + Math.floor(Math.random() * 48*60*60*1000))
    return { postId: post.id, userId: u.id, ghostId: u.ghostId, text: c.text, createdAt: at > new Date() ? new Date() : at }
  })
  if (rows.length) await withRetry(() => prisma.comment.createMany({ data: rows }))
  await withRetry(() => prisma.post.update({ where: { id: post.id }, data: { commentsCount: rows.length } }))
  return { posts: 1, comments: rows.length }
}
async function main() {
  let all = []
  for (const f of FILES) all.push(...JSON.parse(readFileSync(join(process.cwd(), f), "utf-8")))
  console.log("TOTAL="+all.length+" START="+START)
  const users = await withRetry(() => prisma.user.findMany({ where: { email: { endsWith: "@seed.yardapp.me" }, campus: "GCTU" } }))
  const userByGhost = new Map(users.map(u => [u.ghostId, u]))
  console.log("USERS_READY="+userByGhost.size)
  const queue = all.slice(START)
  let done=START, cc=0
  for (let i=0;i<queue.length;i+=CONCURRENCY) {
    const batch = queue.slice(i,i+CONCURRENCY)
    const res = await Promise.all(batch.map(p => seedOne(p, userByGhost).catch(e => { console.log("SKIP "+e.code); return {posts:0,comments:0} })))
    for (const r of res) { done+=r.posts; cc+=r.comments }
    console.log(`PROGRESS posts=${done}/${all.length} comments+=${cc}`)
  }
  console.log(`DONE posts=${done} newComments=${cc}`)
}
main().catch(e => { console.error(e); process.exit(1) }).finally(() => prisma.$disconnect())
