import { PrismaClient } from '@prisma/client'

const prisma = new PrismaClient()

async function safe(name, fn) {
  try {
    const r = await fn()
    console.log(`Deleted ${name}`, r.count ?? "")
  } catch (err) {
    // P2021 = table doesn't exist yet, P2022 = column missing (drift) — skip
    console.log(`Skipped ${name}: ${err.code || err.message}`)
  }
}

async function main() {
  console.log("Deleting all users and related data...")

  // Break BattlePrompt -> BattleEntry winner circular FK first
  await safe("battle winner links", () =>
    prisma.battlePrompt.updateMany({ data: { winnerEntryId: null } })
  ).catch(() => {})

  await safe("comments", () => prisma.comment.deleteMany({}))
  await safe("comments (self-FK retry)", () => prisma.comment.deleteMany({}))
  await safe("votes", () => prisma.vote.deleteMany({}))
  await safe("post votes", () => prisma.postVote.deleteMany({}))
  await safe("post views", () => prisma.postView.deleteMany({}))
  await safe("earnings", () => prisma.earning.deleteMany({}))
  await safe("payouts", () => prisma.payout.deleteMany({}))
  await safe("transactions", () => prisma.transaction.deleteMany({}))
  await safe("reports", () => prisma.report.deleteMany({}))
  await safe("notifications", () => prisma.notification.deleteMany({}))
  await safe("device tokens", () => prisma.deviceToken.deleteMany({}))
  await safe("media uploads", () => prisma.mediaUpload.deleteMany({}))
  await safe("battle entries", () => prisma.battleEntry.deleteMany({}))
  await safe("battle prompts", () => prisma.battlePrompt.deleteMany({}))
  await safe("battle seasons", () => prisma.battleSeason.deleteMany({}))
  await safe("battle stats", () => prisma.battleStats.deleteMany({}))
  await safe("follows", () => prisma.follow.deleteMany({}))
  await safe("AI drafts", () => prisma.aiDraft.deleteMany({}))
  await safe("search history", () => prisma.searchHistory.deleteMany({}))
  await safe("saved searches", () => prisma.savedSearch.deleteMany({}))
  await safe("referrals", () => prisma.referral.deleteMany({}))
  await safe("audit logs", () => prisma.auditLog.deleteMany({}))

  await safe("posts", () => prisma.post.deleteMany({}))

  const deletedUsers = await prisma.user.deleteMany({}).catch((err) => {
    console.log(`Skipped users: ${err.code || err.message}`)
    return { count: 0 }
  })
  console.log(`Deleted ${deletedUsers.count} users`)

  await safe("rate limits", () => prisma.rateLimit.deleteMany({}))
}

main()
  .catch(console.error)
  .finally(() => prisma.$disconnect())