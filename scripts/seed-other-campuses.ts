import "dotenv/config"
import dns from "node:dns"
import { PrismaClient } from "@prisma/client"
import { getProgramKey } from "../lib/program"

// Prefer IPv4: Neon hostnames publish both families, and some sandboxes have
// flaky IPv6 routes that surface as "Can't reach database server".
dns.setDefaultResultOrder("ipv4first")

// The app's pooled Neon endpoint has a small pool. This seed is a long
// sequential writer, so it uses the direct (non-pooler) URL when available:
// one connection, no P2024 pool-timeout errors while the live app is serving.
function seedDatabaseUrl(): string | undefined {
  const raw = process.env.DIRECT_URL || process.env.DATABASE_URL
  if (!raw) return undefined
  try {
    const url = new URL(raw)
    url.searchParams.set("connection_limit", "3")
    url.searchParams.set("pool_timeout", "60")
    return url.toString()
  } catch {
    return raw
  }
}

const databaseUrl = seedDatabaseUrl()
const prisma = new PrismaClient(
  databaseUrl ? { datasources: { db: { url: databaseUrl } } } : undefined
)

type SeedUser = {
  email: string
  ghostId: string
  avatarEmoji: string
  program: string
  cohortYear: number
}

type CampusSeed = {
  campus: string
  slug: string
  users: SeedUser[]
  posts: string[]
  comments: string[]
}

const CAMPUS_SEEDS: CampusSeed[] = [
  {
    campus: "KNUST",
    slug: "knust",
    users: [
      {
        email: "katangakid@seed.yardapp.me",
        ghostId: "KatangaKid",
        avatarEmoji: "🔥",
        program: "BSc Computer Science",
        cohortYear: 2022,
      },
      {
        email: "unityhallghost@seed.yardapp.me",
        ghostId: "UnityHallGhost",
        avatarEmoji: "👻",
        program: "BSc Mechanical Engineering",
        cohortYear: 2023,
      },
      {
        email: "knustengineer@seed.yardapp.me",
        ghostId: "KnustEngineer",
        avatarEmoji: "🛠️",
        program: "BA Economics",
        cohortYear: 2024,
      },
    ],
    posts: [
      "katanga vs unity hall gist: the noise last night was louder than my data structures lecture 😭",
      "engineering stress is real. i've been debugging the same line since 8am and it's not even my project.",
      "why does every knust student say 'i'm coming' and then appear two hours later? explain.",
      "the trotro from campus to kejetia at 6pm is a survival game. if you see me running, mind your business.",
      "lecturer said 'this is a simple question' then wrote a whole proof on the board. simple for who?",
      "katanga boys will argue about football for three hours but can't argue their way out of a resit.",
      "anybody else's roommate plays music at 2am like they're djing a hall week concert?",
      "the canteen rice increased by two cedis and the portion decreased. economics is not working.",
      "i came to knust for the engineering reputation, i stayed for the waakye.",
      "group project: one person disappears, one person does everything, and one person just says 'nice work team'.",
      "the way my hall mates queue for the bathroom in the morning, you'd think there's a limited edition drop inside.",
      "knust wifi is a myth. i've seen ghosts with better connection.",
      "when the lecturer says 'attend all lectures' but the timetable has two classes at the same time. make it make sense.",
      "graduation is near and i still don't know how to use the library catalogue properly. survival.",
      "if you hear 'small boy, come here' around campus, just increase your walking speed. no eye contact.",
    ],
    comments: [
      "this is too real 😭",
      "katanga we move",
      "engineering student and i confirm",
      "eii campus is a movie",
      "who else is suffering like this",
      "i felt this in my soul",
      "the accuracy is scary",
      "my roommate said the same thing yesterday",
      "knust no dey smile",
      "this post deserves more yeahs",
    ],
  },
  {
    campus: "University of Ghana",
    slug: "legon",
    users: [
      {
        email: "legonnightowl@seed.yardapp.me",
        ghostId: "LegonNightOwl",
        avatarEmoji: "🦉",
        program: "BSc Computer Science",
        cohortYear: 2023,
      },
      {
        email: "balmeghost@seed.yardapp.me",
        ghostId: "BalmeGhost",
        avatarEmoji: "📚",
        program: "BSc Administration",
        cohortYear: 2022,
      },
      {
        email: "nightmarketplug@seed.yardapp.me",
        ghostId: "NightMarketPlug",
        avatarEmoji: "🌙",
        program: "BA Political Science",
        cohortYear: 2024,
      },
    ],
    posts: [
      "night market drama: someone bought the last kelewele and the whole line started murmuring 😭",
      "legon hostel struggles: bucket bath at 5am because the bathroom queue is longer than the registration line.",
      "the shuttle from main gate to campus is either empty or full. there is no in-between.",
      "why is the balm from night market always 'the last one'? sister, i can see the box behind you.",
      "lecturer: 'this will be on the exam.' also lecturer: 'i won't give you the slides.'",
      "legon girls will say 'i'm almost ready' and then start looking for their id card.",
      "the way people run when they see the vc's car is a whole sport.",
      "hostel room inspection tomorrow and my roommate just started hiding the electric kettle. teamwork.",
      "night market jollof hits different at 11pm, but the aftermath at 7am is a different story.",
      "every legon student has one friend who knows every shortcut on campus and one who still gets lost at the balme library.",
      "group chat said 'class is cancelled' but nobody checked the notice board. we all showed up.",
      "the printer at the library jammed five minutes before my deadline. this is personal.",
      "legon hostel water: sometimes it's a stream, sometimes it's a memory. today it's a memory.",
      "if you've never negotiated the night market price while hungry, you haven't lived.",
      "graduation gown photos are expensive but the group chat said 'we move'. we move.",
    ],
    comments: [
      "legon is not for the weak 😭",
      "night market never disappoints",
      "i know exactly who this is about",
      "the hostel struggle is real",
      "this is why i don't leave my room",
      "balme library people will understand",
      "eii the accuracy",
      "shuttle queue is a lifestyle",
      "legon gist is unmatched",
      "who else saw this?",
    ],
  },
  {
    campus: "UCC",
    slug: "ucc",
    users: [
      {
        email: "capecoastwave@seed.yardapp.me",
        ghostId: "CapeCoastWave",
        avatarEmoji: "🌊",
        program: "BSc Computer Science",
        cohortYear: 2022,
      },
      {
        email: "ucchostelghost@seed.yardapp.me",
        ghostId: "UccHostelGhost",
        avatarEmoji: "👻",
        program: "BSc Commerce",
        cohortYear: 2023,
      },
      {
        email: "atlanticscholar@seed.yardapp.me",
        ghostId: "AtlanticScholar",
        avatarEmoji: "🎓",
        program: "BA Communication Studies",
        cohortYear: 2024,
      },
    ],
    posts: [
      "cape coast sun is not joking. i left my hostel looking like a snack and arrived looking like a melted sachet.",
      "the walk from the hostel to campus should count as gym. my legs are the evidence.",
      "ucc hostel struggles: when the tap finally runs, everybody in the block hears the good news.",
      "why does it rain every time i decide to wear white? explain the science.",
      "lecturer said 'small class today' and then 200 people showed up. small for which campus?",
      "the canteen food tastes better when it's not your money. that's the real economics.",
      "cape coast beaches are beautiful until you remember there's a quiz tomorrow.",
      "my roommate's alarm rings for 30 minutes every morning. at this point it's our alarm.",
      "trotro drivers in cape coast have a different relationship with speed and jesus.",
      "every ucc student has that one course they keep failing to understand and one lecturer who keeps failing to explain.",
      "the library is full until you actually need a seat. where do all these people come from?",
      "hostel gossip travels faster than the campus wi-fi.",
      "i saw a goat on campus today and it looked more organized than my timetable.",
      "registration week: a test of patience, internet, and your ability to refresh a page.",
      "graduation is coming but my project partner is still on chapter one. pray for me.",
    ],
    comments: [
      "cape coast sun is undefeated 😭",
      "this hostel life ehh",
      "i felt this one",
      "ucc is a movie",
      "the rain will still catch you",
      "my legs are hurting just reading this",
      "canteen queue people know",
      "this is too accurate",
      "atlantic campus problems",
      "who else is surviving on sachet water?",
    ],
  },
]

function randInt(min: number, max: number): number {
  return min + Math.floor(Math.random() * (max - min + 1))
}

function pick<T>(values: readonly T[]): T {
  return values[Math.floor(Math.random() * values.length)]
}

function shuffled<T>(values: readonly T[]): T[] {
  const copy = [...values]
  for (let i = copy.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1))
    ;[copy[i], copy[j]] = [copy[j], copy[i]]
  }
  return copy
}

function sleep(ms: number) {
  return new Promise((resolve) => setTimeout(resolve, ms))
}

async function dbRetry<T>(fn: () => Promise<T>, label: string, attempts = 6): Promise<T> {
  for (let attempt = 1; attempt <= attempts; attempt++) {
    try {
      return await fn()
    } catch (error) {
      if (!isTransientDbError(error) || attempt === attempts) throw error
      const wait = Math.min(attempt * 1500, 6000)
      console.warn(`${label}: database blip (${attempt}/${attempts}), retrying in ${wait}ms...`)
      await sleep(wait)
    }
  }
  throw new Error(`${label}: retries exhausted`)
}

// Neon compute can be suspended when the app is idle. Wake it with a patient
// retry loop before touching seed data.
async function warmDb() {
  await dbRetry(() => prisma.$queryRaw`SELECT 1`, "warmup", 12)
}

async function upsertUsers(seed: CampusSeed) {
  const users = []
  for (const seedUser of seed.users) {
    const user = await dbRetry(() => prisma.user.upsert({
      where: { email: seedUser.email },
      update: {
        campus: seed.campus,
        ghostId: seedUser.ghostId,
        avatarEmoji: seedUser.avatarEmoji,
        program: seedUser.program,
        programLevel: "level 200",
        cohortYear: seedUser.cohortYear,
        programKey: getProgramKey(seed.campus, seedUser.program, seedUser.cohortYear),
        emailVerified: true,
        status: "ACTIVE",
      },
      create: {
        email: seedUser.email,
        // Seed ghosts intentionally cannot log in.
        passwordHash: "seed_account_no_login",
        emailVerified: true,
        campus: seed.campus,
        ghostId: seedUser.ghostId,
        avatarEmoji: seedUser.avatarEmoji,
        program: seedUser.program,
        programLevel: "level 200",
        cohortYear: seedUser.cohortYear,
        programKey: getProgramKey(seed.campus, seedUser.program, seedUser.cohortYear),
        tier: "PLUS",
        status: "ACTIVE",
      },
    }), `upsert ${seedUser.ghostId}`)
    users.push(user)
  }
  return users
}

async function seedPosts(seed: CampusSeed, users: Awaited<ReturnType<typeof upsertUsers>>) {
  const now = Date.now()
  const windowMs = 48 * 60 * 60 * 1000
  let totalVotes = 0

  for (let index = 0; index < seed.posts.length; index++) {
    const id = `seed_${seed.slug}_${index + 1}`
    const author = users[index % users.length]
    const campusUsers = users.filter((user) => user.campus === seed.campus)
    const createdAt = new Date(now - randInt(0, windowMs))
    const yeahs = randInt(4, 80)
    const commentCount = randInt(2, 5)

    const commentRows = Array.from({ length: commentCount }, () => {
      const commenter = pick(campusUsers)
      const elapsed = Math.max(0, now - createdAt.getTime())
      return {
        postId: id,
        userId: commenter.id,
        ghostId: commenter.ghostId,
        text: pick(seed.comments),
        yeahs: randInt(0, 18),
        createdAt: new Date(createdAt.getTime() + randInt(0, elapsed)),
      }
    })

    const voters = shuffled(campusUsers.filter((user) => user.id !== author.id))
      .slice(0, randInt(0, Math.max(0, campusUsers.length - 1)))
      .map((user) => ({
        postId: id,
        userId: user.id,
        createdAt: new Date(createdAt.getTime() + randInt(0, Math.max(0, now - createdAt.getTime()))),
      }))

    await dbRetry(() => prisma.$transaction([
      prisma.comment.deleteMany({ where: { postId: id } }),
      prisma.postVote.deleteMany({ where: { postId: id } }),
    ]), `cleanup ${id}`)

    await dbRetry(() => prisma.post.upsert({
      where: { id },
      update: {
        userId: author.id,
        text: seed.posts[index],
        type: pick(["confession", "gossip", "meme"] as const),
        campus: seed.campus,
        program: author.program,
        programLevel: author.programLevel,
        cohortYear: author.cohortYear,
        programKey: author.programKey,
        visibility: "school",
        archived: false,
        isAd: false,
        isCOTD: false,
        cotdDate: null,
        boosted: false,
        boostedUntil: null,
        pinnedUntil: null,
        yeahs,
        commentsCount: commentRows.length,
        createdAt,
      },
      create: {
        id,
        userId: author.id,
        text: seed.posts[index],
        type: pick(["confession", "gossip", "meme"] as const),
        campus: seed.campus,
        program: author.program,
        programLevel: author.programLevel,
        cohortYear: author.cohortYear,
        programKey: author.programKey,
        visibility: "school",
        yeahs,
        commentsCount: commentRows.length,
        createdAt,
      },
    }), `upsert ${id}`)

    if (commentRows.length > 0) {
      await dbRetry(() => prisma.comment.createMany({ data: commentRows }), `comments ${id}`)
    }
    if (voters.length > 0) {
      await dbRetry(() => prisma.postVote.createMany({ data: voters, skipDuplicates: true }), `votes ${id}`)
    }

    totalVotes += voters.length
  }

  return { totalVotes }
}

async function verify(seed: CampusSeed) {
  const prefix = `seed_${seed.slug}_`
  const [postCount, wrongCampus, commentCount] = await Promise.all([
    dbRetry(() => prisma.post.count({ where: { id: { startsWith: prefix }, campus: seed.campus, visibility: "school" } }), `count ${prefix}`),
    dbRetry(() => prisma.post.count({ where: { id: { startsWith: prefix }, campus: { not: seed.campus } } }), `wrong campus ${prefix}`),
    dbRetry(() => prisma.comment.count({ where: { postId: { startsWith: prefix } } }), `comments ${prefix}`),
  ])
  return { postCount, wrongCampus, commentCount }
}

async function seedAll() {
  await warmDb()
  console.log("seeding KNUST, University of Ghana (Legon), and UCC...\n")

  const results: { campus: string; posts: number; comments: number; votes: number; wrongCampus: number }[] = []

  for (const seed of CAMPUS_SEEDS) {
    const users = await upsertUsers(seed)
    const { totalVotes } = await seedPosts(seed, users)
    const check = await verify(seed)
    results.push({
      campus: seed.campus,
      posts: check.postCount,
      comments: check.commentCount,
      votes: totalVotes,
      wrongCampus: check.wrongCampus,
    })
    console.log(
      `${seed.campus}: ${check.postCount} posts, ${check.commentCount} comments, ${totalVotes} post votes ` +
        `(${users.map((user) => user.ghostId).join(", ")})`
    )
  }

  console.log("\n--- seed summary ---")
  for (const row of results) {
    console.log(
      `${row.campus}: ${row.posts}/15 posts, ${row.comments} comments, ${row.votes} votes, ` +
        `${row.wrongCampus} posts in the wrong campus`
    )
  }

  const bad = results.filter((row) => row.posts !== 15 || row.wrongCampus !== 0)
  if (bad.length > 0) {
    throw new Error(`seed verification failed: ${JSON.stringify(bad)}`)
  }

  console.log("\nmulti-campus seed complete. campus feeds are isolated.")
}

function isTransientDbError(error: unknown): boolean {
  const text =
    error instanceof Error
      ? `${(error as { code?: unknown }).code ?? ""} ${error.message}`
      : String(error)
  return ["P1001", "P1002", "P1017", "P2024", "Timed out fetching", "Can't reach database", "Connection"].some(
    (pattern) => text.includes(pattern)
  )
}

async function main() {
  // The whole seed is idempotent (fixed post ids + upserts), so a Neon
  // cold-start/pool blip can safely restart from the top.
  const maxAttempts = 4
  for (let attempt = 1; attempt <= maxAttempts; attempt++) {
    try {
      await seedAll()
      return
    } catch (error) {
      if (!isTransientDbError(error) || attempt === maxAttempts) throw error
      console.warn(`database connection blip, retrying seed (${attempt}/${maxAttempts - 1})...`)
      await sleep(attempt * 3000)
    }
  }
}

main()
  .catch((error) => {
    console.error(error)
    process.exitCode = 1
  })
  .finally(async () => {
    await prisma.$disconnect()
  })
