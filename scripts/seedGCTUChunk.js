import { PrismaClient } from "@prisma/client"
import { readFileSync } from "fs"
import { join } from "path"
const prisma = new PrismaClient()
const CONCURRENCY = 8
const file = process.argv[2]
if (!file) { console.error("usage: seedGCTUChunk.js <chunk.json>"); process.exit(2) }

async function seedOne(p, userByGhost) {
  const author = userByGhost.get(p.authorGhost)
  if (!author) return { posts: 0, comments: 0 }
  const createdAt = new Date(Date.now() - Math.floor(Math.random() * 120 * 60 * 60 * 1000))
  const post = await prisma.post.create({
    data: {
      userId: author.id, text: p.text,
      type: ["confession", "gossip", "meme"].includes(p.type) ? p.type : "confession",
      campus: "GCTU", visibility: "school",
      yeahs: typeof p.yeahs === "number" ? p.yeahs : 0,
      boosted: !!p.boosted,
      boostedUntil: p.boosted ? new Date(Date.now() + 7 * 24 * 60 * 60 * 1000) : null,
      createdAt,
    },
  })
  const tags = [...new Set([...p.text.matchAll(/#(\w+)/g)].map(m => m[1].toLowerCase()))]
  for (const tag of tags) {
    const hashtag = await prisma.hashtag.upsert({
      where: { tag },
      update: { postsCount: { increment: 1 }, lastUsedAt: new Date() },
      create: { tag, campus: "GCTU", postsCount: 1 },
    }).catch(() => null)
    if (hashtag) await prisma.postHashtag.create({ data: { postId: post.id, hashtagId: hashtag.id } }).catch(() => {})
  }
  const rows = (p.comments || []).map(c => {
    const u = userByGhost.get(c.ghostId) || author
    const at = new Date(createdAt.getTime() + Math.floor(Math.random() * 20 * 60 * 60 * 1000))
    return { postId: post.id, userId: u.id, ghostId: u.ghostId, text: c.text, createdAt: at > new Date() ? new Date() : at }
  })
  if (rows.length) await prisma.comment.createMany({ data: rows })
  await prisma.post.update({ where: { id: post.id }, data: { commentsCount: rows.length } })
  return { posts: 1, comments: rows.length }
}

async function main() {
  const all = JSON.parse(readFileSync(join(process.cwd(), file), "utf-8"))
  console.log("FILE=" + file + " TOTAL=" + all.length)
  const ghostMap = new Map()
  for (const p of all) {
    if (p.authorGhost && !ghostMap.has(p.authorGhost)) ghostMap.set(p.authorGhost, p.authorAvatar || "??")
    for (const c of p.comments || []) if (c.ghostId && !ghostMap.has(c.ghostId)) ghostMap.set(c.ghostId, c.avatarEmoji || "??")
  }
  for (const [ghostId, avatarEmoji] of ghostMap) {
    await prisma.user.upsert({
      where: { email: `${ghostId.toLowerCase()}@seed.yardapp.me` },
      update: { campus: "GCTU", avatarEmoji },
      create: { email: `${ghostId.toLowerCase()}@seed.yardapp.me`, passwordHash: "not_a_real_account", emailVerified: true, campus: "GCTU", ghostId, avatarEmoji },
    })
  }
  const users = await prisma.user.findMany({ where: { email: { endsWith: "@seed.yardapp.me" }, campus: "GCTU" } })
  const userByGhost = new Map(users.map(u => [u.ghostId, u]))
  let done = 0, cc = 0
  for (let i = 0; i < all.length; i += CONCURRENCY) {
    const res = await Promise.all(all.slice(i, i + CONCURRENCY).map(p => seedOne(p, userByGhost)))
    for (const r of res) { done += r.posts; cc += r.comments }
    if (done % 80 < CONCURRENCY) console.log(`PROGRESS posts=${done} comments=${cc}`)
  }
  console.log(`CHUNK_DONE posts=${done} comments=${cc}`)
}
main().catch(e => { console.error(e); process.exit(1) }).finally(() => prisma.$disconnect())