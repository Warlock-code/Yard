import { PrismaClient } from "@prisma/client"

const prisma = new PrismaClient()

// Campus launch packs: hall rivalries + exam-season + food/gist staples.
// Created as DORMANT drafts (startsAt 2030, UPCOMING) — the battles cron only
// auto-activates prompts whose startsAt has passed, so these never go live
// until an admin pulls one forward. Safe to run on a live DB. Re-runs skip
// any (campus, text) that already has an UPCOMING/ACTIVE prompt.
const TEMPLATES = [
  {
    campus: "KNUST",
    prompts: [
      "katanga vs unity: which hall really runs knust? 🏆",
      "exam szn confessions: your most unhinged night-class story 📚",
      "which knust food joint never misses? 🍲",
    ],
  },
  {
    campus: "UCC",
    prompts: [
      "atlantic vs adehye: which hall owns ucc? 🏆",
      "exam szn: that one lecture you understood zero percent of 📚",
      "cape coast nights: best chill spot after lectures? 🌊",
    ],
  },
  {
    campus: "GCTU",
    prompts: [
      "tesano vs off-campus: where do real gctu nights happen? 🏆",
      "exam szn: the course you carried with pure midnight oil 📚",
      "gctu canteen wars: best jollof on campus? 🍲",
    ],
  },
  {
    campus: "UPSA",
    prompts: [
      "hostel vs home: where do upsa legends live? 🏆",
      "exam szn: your gpa-saving confession 📊",
      "acca/icag survival stories: how are you coping? 💼",
    ],
  },
  {
    campus: "University of Ghana",
    prompts: [
      "sarbah vs commonwealth: which hall runs legon? 🏆",
      "exam szn: balme library 2am stories 📚",
      "legon hall week: your best memory? 🎉",
    ],
  },
]

async function main() {
  let created = 0
  let skipped = 0
  // Stagger draft dates through Jan 2030 so an admin can pull them forward one by one.
  let dayOffset = 0
  for (const { campus, prompts } of TEMPLATES) {
    for (const text of prompts) {
      const existing = await prisma.battlePrompt.findFirst({
        where: { campus, text, status: { in: ["UPCOMING", "ACTIVE"] } },
        select: { id: true },
      })
      if (existing) {
        skipped++
        continue
      }
      const startsAt = new Date(Date.UTC(2030, 0, 1 + dayOffset, 12, 0, 0))
      await prisma.battlePrompt.create({
        data: {
          text,
          campus,
          type: "SINGLE",
          status: "UPCOMING",
          startsAt,
          endsAt: new Date(startsAt.getTime() + 48 * 60 * 60 * 1000),
          totalRounds: 1,
          roundNumber: 1,
          entryType: "TEXT",
        },
      })
      created++
      dayOffset++
    }
  }
  console.log(`campus battle templates: ${created} created, ${skipped} skipped (already exist)`)
}

main()
  .catch((err) => {
    console.error(err)
    process.exit(1)
  })
  .finally(() => prisma.$disconnect())
