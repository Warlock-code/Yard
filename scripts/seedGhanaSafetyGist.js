import { PrismaClient } from "@prisma/client"
import fs from "fs"
import path from "path"
const prisma = new PrismaClient()

const SEED_GHOSTS = [
  { ghostId: "MidnightScholar", avatarEmoji: "👻" },
  { ghostId: "QuietStorm_22", avatarEmoji: "🐍" },
  { ghostId: "CampusWhisperer", avatarEmoji: "👽" },
  { ghostId: "HallwayGhost", avatarEmoji: "👻" },
  { ghostId: "TheRealTalker", avatarEmoji: "🧙" },
  { ghostId: "SilentObserver", avatarEmoji: "🦇" },
  { ghostId: "NightOwlNotes", avatarEmoji: "👻" },
  { ghostId: "LibraryLurker", avatarEmoji: "🕷️" },
  { ghostId: "DailyConfessor", avatarEmoji: "😂" },
  { ghostId: "CanteenCritic", avatarEmoji: "👻" },
  { ghostId: "CapeCoastGirl", avatarEmoji: "🌊" },
  { ghostId: "AyeduaseBabe", avatarEmoji: "🌙" },
  { ghostId: "BomsoWatcher", avatarEmoji: "👀" },
  { ghostId: "TechJunctionEye", avatarEmoji: "👁️" },
  { ghostId: "KwaprowAnon", avatarEmoji: "🤲" },
  { ghostId: "KNUST_Survivor", avatarEmoji: "💙" },
  { ghostId: "UG_SafetySquad", avatarEmoji: "🛡️" },
  { ghostId: "UCC_Counsellor", avatarEmoji: "🎓" },
  { ghostId: "SisterSafety", avatarEmoji: "💜" },
  { ghostId: "HallSec_Anon", avatarEmoji: "🤫" },
]

async function main() {
  const seedPath = path.join(process.cwd(), "ghana-safety-dark-gist-seed.json")
  const raw = fs.readFileSync(seedPath, "utf-8")
  const gistPosts = JSON.parse(raw)

  const users = []
  for (const g of SEED_GHOSTS) {
    const user = await prisma.user.upsert({
      where: { email: `${g.ghostId.toLowerCase()}@seed.yardapp.me` },
      update: {},
      create: {
        email: `${g.ghostId.toLowerCase()}@seed.yardapp.me`,
        passwordHash: "not_a_real_account",
        emailVerified: true,
        campus: "KNUST",
        ghostId: g.ghostId,
        avatarEmoji: g.avatarEmoji,
      },
    })
    users.push(user)
  }
  const userByGhost = new Map(users.map(u => [u.ghostId, u]))
  const fallbackGhosts = users

  let created = 0
  for (let idx = 0; idx < gistPosts.length; idx++) {
    const p = gistPosts[idx]
    // pick author round-robin from seed ghosts
    const authorGhost = SEED_GHOSTS[idx % SEED_GHOSTS.length]
    let author = userByGhost.get(authorGhost.ghostId)
    if (!author) author = fallbackGhosts[idx % fallbackGhosts.length]
    if (author.campus !== p.campus) {
      await prisma.user.update({ where: { id: author.id }, data: { campus: p.campus } }).catch(()=>{})
    }
    const post = await prisma.post.create({
      data: {
        userId: author.id,
        text: p.text,
        type: p.type,
        campus: p.campus,
        visibility: "school",
        yeahs: p.yeahs,
        boosted: p.boosted,
        boostedUntil: p.boosted ? new Date(p.boostedUntil) : null,
        createdAt: new Date(Date.now() - Math.floor(Math.random()* 72 * 60 * 60 * 1000)), // last 72h for feed ranking
      },
    })
    // hashtags
    const tags = [...new Set((p.hashtags || []).map(t => t.replace("#","").toLowerCase()))]
    for (const tag of tags) {
      const hashtag = await prisma.hashtag.upsert({
        where: { tag },
        update: { postsCount: { increment: 1 }, trendingScore: { increment: p.yeahs/10 }, lastUsedAt: new Date() },
        create: { tag, campus: p.campus, postsCount: 1, trendingScore: p.yeahs/10 },
      })
      await prisma.postHashtag.create({ data: { postId: post.id, hashtagId: hashtag.id } }).catch(()=>{})
    }
    for (const c of p.comments) {
      let commenter = userByGhost.get(c.ghostId)
      if (!commenter) {
        // fallback to random seed ghost
        commenter = fallbackGhosts[Math.floor(Math.random()*fallbackGhosts.length)]
      }
      await prisma.comment.create({
        data: {
          postId: post.id,
          userId: commenter.id,
          ghostId: commenter.ghostId,
          text: c.text,
        },
      })
    }
    await prisma.post.update({
      where: { id: post.id },
      data: { commentsCount: p.comments.length }
    })
    created++
  }
  console.log(`Seeded ${created} Ghana safety/darker gist posts with comments.`)
}

main().catch(e=>{console.error(e);process.exit(1)}).finally(()=>prisma.$disconnect())
