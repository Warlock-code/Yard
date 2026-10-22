/**
 * One-time referral payout backfill.
 *
 * The old payout lived only in /api/auth/verify-email. New accounts are
 * auto-verified on signup, so rows created before this fix can still be
 * status "pending" even though the referred user is verified.
 *
 * Run:
 *   npx tsx scripts/backfill-referral-rewards.ts --dry-run
 *   npx tsx scripts/backfill-referral-rewards.ts
 *
 * Payouts are idempotent — re-running is safe.
 */
import "dotenv/config"
import { prisma } from "@/lib/prisma"
import { completeReferralReward } from "@/lib/referral-rewards"

const dryRun = process.argv.includes("--dry-run")

async function main() {
  const pending = await prisma.referral.findMany({
    where: {
      status: "pending",
      rewardStatus: "none",
      referred: { is: { emailVerified: true } },
    },
    select: { id: true, referrerId: true, referredId: true },
    orderBy: { createdAt: "asc" },
  })

  console.log(
    `[referral-backfill] found ${pending.length} pending verified referral(s)${dryRun ? " (dry run)" : ""}`
  )

  if (dryRun) {
    for (const row of pending) {
      console.log(
        `[referral-backfill] would pay referral ${row.id} (referrer ${row.referrerId}, referred ${row.referredId})`
      )
    }
    return
  }

  const results: Record<string, number> = {}
  for (const row of pending) {
    try {
      const result = await completeReferralReward(row.referredId)
      results[result.status] = (results[result.status] ?? 0) + 1
      console.log(`[referral-backfill] referral ${row.id}: ${result.status}`)
    } catch (err) {
      results.error = (results.error ?? 0) + 1
      console.error(`[referral-backfill] referral ${row.id}: failed`, err)
    }
  }

  console.log("[referral-backfill] complete", results)
}

main()
  .catch((err) => {
    console.error("[referral-backfill] fatal", err)
    process.exitCode = 1
  })
  .finally(async () => {
    await prisma.$disconnect()
  })
