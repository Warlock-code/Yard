import { PrismaClient } from "@prisma/client"
import { readFileSync } from "fs"
import { join } from "path"
const prisma = new PrismaClient()

const SEED_GHOSTS = [
  { ghostId: "MidnightScholar", avatarEmoji: "👻", campus: "University of Ghana" },
  { ghostId: "QuietStorm_22", avatarEmoji: "🐍", campus: "KNUST" },
  { ghostId: "CampusWhisperer", avatarEmoji: "👽", campus: "UCC" },
  { ghostId: "HallwayGhost", avatarEmoji: "👻", campus: "KNUST" },
  { ghostId: "TheRealTalker", avatarEmoji: "🧙", campus: "University of Ghana" },
  { ghostId: "SilentObserver", avatarEmoji: "🦇", campus: "UCC" },
  { ghostId: "NightOwlNotes", avatarEmoji: "👻", campus: "KNUST" },
  { ghostId: "LibraryLurker", avatarEmoji: "🕷️", campus: "UEW" },
  { ghostId: "DailyConfessor", avatarEmoji: "😂", campus: "UPSA" },
  { ghostId: "CanteenCritic", avatarEmoji: "👻", campus: "GCTU" },
  { ghostId: "DriftStorm_9394", avatarEmoji: "👻", campus: "GCTU" },
  { ghostId: "LegonSleeper", avatarEmoji: "😴", campus: "University of Ghana" },
]

async function main() {
  console.log("Seeding Ghana LOVE gist (70 posts) to balance hate...")

  // Upsert ghosts
  const users = []
  for (const g of SEED_GHOSTS) {
    const user = await prisma.user.upsert({
      where: { email: `${g.ghostId.toLowerCase()}@seed.yardapp.me` },
      update: {},
      create: {
        email: `${g.ghostId.toLowerCase()}@seed.yardapp.me`,
        passwordHash: "not_a_real_account",
        emailVerified: true,
        campus: g.campus,
        ghostId: g.ghostId,
        avatarEmoji: g.avatarEmoji,
      },
    })
    users.push(user)
  }
  const userByGhost = new Map(users.map(u => [u.ghostId, u]))
  console.log(`Upserted ${users.length} ghosts`)

  // Load JSON
  const jsonPath = join(process.cwd(), "ghana-love-gist-seed.json")
  const raw = readFileSync(jsonPath, "utf-8")
  const lovePosts = JSON.parse(raw)
  console.log(`Loaded ${lovePosts.length} love posts from ${jsonPath}`)

  let created = 0
  let commentCount = 0
  for (let i = 0; i < lovePosts.length; i++) {
    const p = lovePosts[i]
    // Pick author round-robin from ghosts, ensure campus matches post campus for feed visibility
    const authorGhost = SEED_GHOSTS[i % SEED_GHOSTS.length]
    const author = userByGhost.get(authorGhost.ghostId)
    if (!author) continue

    // Ensure author's campus matches post campus (helps school feed filtering)
    if (author.campus !== p.campus) {
      await prisma.user.update({ where: { id: author.id }, data: { campus: p.campus } }).catch(()=>{})
      author.campus = p.campus
    }

    // Spread createdAt over last 72h for natural feed ranking (love posts recent)
    const createdAt = new Date(Date.now() - Math.floor(Math.random() * 72 * 60 * 60 * 1000))

    const post = await prisma.post.create({
      data: {
        userId: author.id,
        text: p.text,
        type: p.type, // confession | gossip | meme
        campus: p.campus,
        visibility: "school",
        yeahs: p.yeahs,
        boosted: p.boosted || false,
        boostedUntil: p.boosted && p.boostedUntil ? new Date(p.boostedUntil) : p.boosted ? new Date(Date.now() + 7*24*60*60*1000) : null,
        createdAt,
      },
    })

    // Hashtags - use shared lib if available, fallback to manual
    try {
      const { processPostHashtags } = await import("../lib/search.ts")
      await processPostHashtags(post.id, p.text, p.campus)
    } catch {
      // fallback manual hashtag insert
      const tags = [...p.text.matchAll(/#(\w+)/g)].map(m=> m[1].toLowerCase())
      for (const tag of [...new Set(tags)]) {
        const hashtag = await prisma.hashtag.upsert({
          where: { tag },
          update: { postsCount: { increment: 1 }, lastUsedAt: new Date() },
          create: { tag, campus: p.campus, postsCount: 1 },
        }).catch(()=>null)
        if (hashtag) await prisma.postHashtag.create({ data: { postId: post.id, hashtagId: hashtag.id } }).catch(()=>{})
      }
    }

    for (const c of p.comments) {
      const commenter = userByGhost.get(c.ghostId) || author
      await prisma.comment.create({
        data: {
          postId: post.id,
          userId: commenter.id,
          ghostId: commenter.ghostId,
          text: c.text,
        },
      })
      commentCount++
    }
    await prisma.post.update({
      where: { id: post.id },
      data: { commentsCount: p.comments.length }
    })
    created++
  }
  console.log(`Seeded ${created} LOVE gist posts with ${commentCount} comments (~${(commentCount/created).toFixed(1)} per post).`)
  console.log(`Boosted ${lovePosts.filter(p=>p.boosted).length} posts (30%) for visibility.`)
}

main().catch(e=>{console.error(e); process.exit(1)}).finally(()=>prisma.$disconnect())
