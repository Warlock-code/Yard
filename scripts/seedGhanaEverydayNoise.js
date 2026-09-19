import { PrismaClient } from "@prisma/client"
const prisma = new PrismaClient()

const GHOSTS = [
  { ghostId: "MidnightScholar", avatarEmoji: "👻", campus: "University of Ghana", email: "midnightscholar@seed.yardapp.me" },
  { ghostId: "QuietStorm_22", avatarEmoji: "🐍", campus: "KNUST", email: "quietstorm_22@seed.yardapp.me" },
  { ghostId: "CampusWhisperer", avatarEmoji: "👽", campus: "UCC", email: "campuswhisperer@seed.yardapp.me" },
  { ghostId: "HallwayGhost", avatarEmoji: "👻", campus: "KNUST", email: "hallwayghost@seed.yardapp.me" },
  { ghostId: "TheRealTalker", avatarEmoji: "🧙", campus: "University of Ghana", email: "therealtalker@seed.yardapp.me" },
  { ghostId: "SilentObserver", avatarEmoji: "🦇", campus: "UCC", email: "silentobserver@seed.yardapp.me" },
  { ghostId: "NightOwlNotes", avatarEmoji: "👻", campus: "KNUST", email: "nightowlnotes@seed.yardapp.me" },
  { ghostId: "LibraryLurker", avatarEmoji: "🕷️", campus: "UEW", email: "librarylurker@seed.yardapp.me" },
  { ghostId: "DailyConfessor", avatarEmoji: "😂", campus: "UPSA", email: "dailyconfessor@seed.yardapp.me" },
  { ghostId: "CanteenCritic", avatarEmoji: "👻", campus: "GCTU", email: "canteencritic@seed.yardapp.me" },
  { ghostId: "DriftStorm_9394", avatarEmoji: "👻", campus: "GCTU", email: "driftstorm_9394@seed.yardapp.me" },
  { ghostId: "LegonSleeper", avatarEmoji: "😴", campus: "University of Ghana", email: "legonsleeper@seed.yardapp.me" },
  { ghostId: "TrotroSurvivor", avatarEmoji: "🚐", campus: "University of Ghana", email: "trotrosurvivor@seed.yardapp.me" },
  { ghostId: "Katkatanomics", avatarEmoji: "🔥", campus: "KNUST", email: "katkatanomics@seed.yardapp.me" },
  { ghostId: "WiFiGhost", avatarEmoji: "📶", campus: "KNUST", email: "wifighost@seed.yardapp.me" },
  { ghostId: "CorporateHustler", avatarEmoji: "💼", campus: "KNUST", email: "corporatehustler@seed.yardapp.me" },
  { ghostId: "CanteenVeteran", avatarEmoji: "🍲", campus: "UCC", email: "canteenveteran@seed.yardapp.me" },
  { ghostId: "CapeCoastBookie", avatarEmoji: "📚", campus: "UCC", email: "capecoastbookie@seed.yardapp.me" },
  { ghostId: "ScholarByMistake", avatarEmoji: "🤓", campus: "UCC", email: "scholarbymistake@seed.yardapp.me" },
  { ghostId: "HallWatcher99", avatarEmoji: "👀", campus: "KNUST", email: "hallwatcher99@seed.yardapp.me" },
  { ghostId: "SingleAndPassed", avatarEmoji: "💔", campus: "UPSA", email: "singleandpassed@seed.yardapp.me" },
  { ghostId: "MatchingFits", avatarEmoji: "👫", campus: "UPSA", email: "matchingfits@seed.yardapp.me" },
  { ghostId: "PureWaterCEO", avatarEmoji: "💧", campus: "KNUST", email: "purewaterceo@seed.yardapp.me" },
  { ghostId: "AttendanceKing", avatarEmoji: "📝", campus: "GCTU", email: "attendanceking@seed.yardapp.me" },
  { ghostId: "GroupProjectGhost", avatarEmoji: "👥", campus: "GCTU", email: "groupprojectghost@seed.yardapp.me" },
  { ghostId: "BushCanteenLover", avatarEmoji: "🍛", campus: "University of Ghana", email: "bushcanteenlover@seed.yardapp.me" },
  { ghostId: "GCTUPlug", avatarEmoji: "🔌", campus: "GCTU", email: "gctuplug@seed.yardapp.me" },
  { ghostId: "UPSA_Slayer", avatarEmoji: "😎", campus: "UPSA", email: "upsa_slayer@seed.yardapp.me" },
  { ghostId: "UEW_Warrior", avatarEmoji: "🎓", campus: "UEW", email: "uew_warrior@seed.yardapp.me" },
  { ghostId: "UnityAnon", avatarEmoji: "😏", campus: "KNUST", email: "unityanon@seed.yardapp.me" },
]

import gistPosts from "../ghana-uni-everyday-noise-gist-seed.json" assert { type: "json" }

async function main() {
  console.log("Seeding Ghana uni everyday noise gist...")
  const users = []
  for (const g of GHOSTS) {
    const user = await prisma.user.upsert({
      where: { email: g.email },
      update: {},
      create: {
        email: g.email,
        passwordHash: "not_a_real_account",
        emailVerified: true,
        campus: g.campus,
        ghostId: g.ghostId,
        avatarEmoji: g.avatarEmoji,
      },
    })
    users.push(user)
  }
  console.log(`Upserted ${users.length} ghosts`)
  const userByGhost = new Map(users.map(u => [u.ghostId, u]))

  // fallback for comment ghosts not in GHOSTS list - create on fly
  async function getOrCreateGhost(ghostId, avatarEmoji) {
    if (userByGhost.has(ghostId)) return userByGhost.get(ghostId)
    const email = `${ghostId.toLowerCase()}@seed.yardapp.me`
    const user = await prisma.user.upsert({
      where: { email },
      update: {},
      create: {
        email,
        passwordHash: "not_a_real_account",
        emailVerified: true,
        campus: "KNUST",
        ghostId,
        avatarEmoji: avatarEmoji || "👻",
      },
    })
    userByGhost.set(ghostId, user)
    return user
  }

  let postCount = 0
  let commentCount = 0
  // ensure ghosts for comment authors exist before seeding posts
  for (const p of gistPosts) {
    for (const c of p.comments) {
      await getOrCreateGhost(c.ghostId, c.avatarEmoji)
    }
  }

  for (let i = 0; i < gistPosts.length; i++) {
    const p = gistPosts[i]
    // pick random author from GHOSTS for variety, but keep campus consistent for feed
    const authorGhost = GHOSTS[i % GHOSTS.length]
    const author = userByGhost.get(authorGhost.ghostId)
    // if author campus mismatch, update to post campus for visibility
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
        commentsCount: p.comments.length,
        boosted: p.boosted,
        boostedUntil: p.boosted ? new Date(p.boostedUntil) : null,
        createdAt: new Date(Date.now() - Math.floor(Math.random()*72*60*60*1000)), // last 72h
      },
    })
    const tags = [...post.text.matchAll(/#(\w+)/g)].map(m=> m[1].toLowerCase())
    for (const tag of [...new Set(tags)]) {
      const hashtag = await prisma.hashtag.upsert({
        where: { tag },
        update: { postsCount: { increment: 1 }, trendingScore: { increment: p.yeahs/10 }, lastUsedAt: new Date() },
        create: { tag, campus: p.campus, postsCount: 1, trendingScore: p.yeahs/10 },
      })
      await prisma.postHashtag.create({ data: { postId: post.id, hashtagId: hashtag.id } }).catch(()=>{})
    }
    for (const c of p.comments) {
      const commenter = userByGhost.get(c.ghostId)
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
    postCount++
  }
  console.log(`Seeded ${postCount} posts, ${commentCount} comments`)
}

main().catch(e=>{console.error(e);process.exit(1)}).finally(()=>prisma.$disconnect())
