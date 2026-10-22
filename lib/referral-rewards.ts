import { prisma } from "@/lib/prisma"
import { REFERRAL_CONFIG } from "@/lib/referral-config"
import { CREDIT_CONFIG, creditUserTx } from "@/lib/credits"

export type ReferralRewardStatus =
  | "completed"
  | "flagged"
  | "capped"
  | "already_completed"
  | "not_verified"
  | "no_referral_record"
  | "referrer_missing"
  | "self_referral"
  | "user_missing"

export type ReferralRewardResult = {
  status: ReferralRewardStatus
  referredId: string
  referrerId?: string
  referrerReward?: number
  refereeReward?: number
  boosted?: boolean
}

/**
 * Complete and pay a referral exactly once.
 *
 * New signups are auto-verified, so /api/auth/signup calls this immediately
 * after creating the referral row. /api/auth/verify-email also calls it as a
 * fallback for older verification-code accounts, and the referral stats route
 * uses it to repair rows left pending by the previous verify-only flow.
 *
 * Idempotency: the pending -> completed claim is an atomic updateMany inside
 * the same transaction that writes both credit ledger rows. Concurrent or
 * repeated calls therefore cannot pay the same referral twice.
 */
export async function completeReferralReward(referredUserId: string): Promise<ReferralRewardResult> {
  const result = await prisma.$transaction(
    async (tx): Promise<ReferralRewardResult> => {
      const now = new Date()

      const referred = await tx.user.findUnique({
        where: { id: referredUserId },
        select: { id: true, emailVerified: true },
      })
      if (!referred) return { status: "user_missing", referredId: referredUserId }
      if (!referred.emailVerified) return { status: "not_verified", referredId: referredUserId }

      const referral = await tx.referral.findUnique({
        where: { referredId: referredUserId },
        select: { id: true, referrerId: true, status: true, rewardStatus: true },
      })
      if (!referral) return { status: "no_referral_record", referredId: referredUserId }
      if (referral.referrerId === referredUserId) {
        return { status: "self_referral", referredId: referredUserId, referrerId: referral.referrerId }
      }

      // A completed row (including a daily-cap row with rewardStatus "none")
      // means the payout was already evaluated. Never pay it again.
      if (referral.status === "completed" || referral.rewardStatus !== "none") {
        return { status: "already_completed", referredId: referredUserId, referrerId: referral.referrerId }
      }

      const referrer = await tx.user.findUnique({
        where: { id: referral.referrerId },
        select: { id: true },
      })
      if (!referrer) {
        return { status: "referrer_missing", referredId: referredUserId, referrerId: referral.referrerId }
      }

      // Repair safety net: the old verify-email flow wrote the two ledger
      // rows before updating the Referral row, so a partial failure could
      // leave credits paid but status still pending. Do not pay again.
      const [existingReferrerPayout, existingRefereePayout] = await Promise.all([
        tx.creditTransaction.findFirst({
          where: {
            userId: referral.referrerId,
            type: "REFERRAL",
            reference: `referral_${referredUserId}`,
          },
          select: { amount: true, createdAt: true },
        }),
        tx.creditTransaction.findFirst({
          where: {
            userId: referredUserId,
            type: "REFERRAL",
            reference: `referral_${referral.referrerId}`,
          },
          select: { createdAt: true },
        }),
      ])
      if (existingReferrerPayout || existingRefereePayout) {
        await tx.referral.updateMany({
          where: { referredId: referredUserId, status: "pending" },
          data: {
            status: "completed",
            rewardStatus: "completed",
            rewardAmount: existingReferrerPayout?.amount ?? 0,
            completedAt: existingReferrerPayout?.createdAt ?? existingRefereePayout?.createdAt ?? now,
          },
        })
        return { status: "already_completed", referredId: referredUserId, referrerId: referral.referrerId }
      }

      // Claim the referral. Only one concurrent transaction can move it out
      // of pending; the losing transaction re-checks the predicate after the
      // row lock is released and gets count 0.
      const claimed = await tx.referral.updateMany({
        where: { referredId: referredUserId, status: "pending", rewardStatus: "none" },
        data: { status: "completed", completedAt: now, rewardStatus: "none", rewardAmount: 0 },
      })
      if (claimed.count === 0) {
        return { status: "already_completed", referredId: referredUserId, referrerId: referral.referrerId }
      }

      // Daily cap is based on the referral's creation day, preserving the
      // original reward semantics.
      const dayStart = new Date(now)
      dayStart.setHours(0, 0, 0, 0)
      const dayEnd = new Date(dayStart)
      dayEnd.setDate(dayEnd.getDate() + 1)

      const todaysRewarded = await tx.referral.count({
        where: {
          referrerId: referrer.id,
          rewardStatus: "completed",
          createdAt: { gte: dayStart, lt: dayEnd },
        },
      })

      if (todaysRewarded >= REFERRAL_CONFIG.DAILY_CAP) {
        return {
          status: "capped",
          referredId: referredUserId,
          referrerId: referrer.id,
          referrerReward: 0,
          refereeReward: 0,
          boosted: false,
        }
      }

      // Referral boost: an unused REFERRAL_BOOST makes this referral pay 2x.
      // Unused boosts stack. Failure to read boost history falls back to 1x.
      let boosted = false
      try {
        const [boosts, usedBoosts] = await Promise.all([
          tx.creditTransaction.count({ where: { userId: referrer.id, type: "REFERRAL_BOOST" } }),
          tx.creditTransaction.count({
            where: { userId: referrer.id, type: "REFERRAL", metadata: { path: ["boosted"], equals: true } },
          }),
        ])
        boosted = boosts > usedBoosts
      } catch {
        boosted = false
      }

      const boostMult = boosted ? 2 : 1
      const referrerReward = CREDIT_CONFIG.EARN.REFERRAL_REFERRER * boostMult
      const refereeReward = CREDIT_CONFIG.EARN.REFERRAL_REFEREE * boostMult

      // Velocity flag: unusually high referral rate in the last 7 days.
      const weekStart = new Date(now)
      weekStart.setDate(weekStart.getDate() - 7)
      const weekReferrals = await tx.referral.count({
        where: {
          referrerId: referrer.id,
          createdAt: { gte: weekStart },
        },
      })
      const shouldFlag = weekReferrals >= REFERRAL_CONFIG.VELOCITY_THRESHOLD

      await creditUserTx(tx, referrer.id, "REFERRAL", referrerReward, `referral_${referredUserId}`, {
        refereeId: referredUserId,
        type: "referrer",
        ...(boosted ? { boosted: true } : {}),
      })
      await creditUserTx(tx, referredUserId, "REFERRAL", refereeReward, `referral_${referrer.id}`, {
        referrerId: referrer.id,
        type: "referee",
        ...(boosted ? { boosted: true } : {}),
      })

      await tx.referral.update({
        where: { referredId: referredUserId },
        data: {
          rewardStatus: shouldFlag ? "flagged" : "completed",
          rewardAmount: referrerReward,
        },
      })

      if (shouldFlag) {
        await tx.report.create({
          data: {
            reporterId: referrer.id,
            reason: `High referral velocity: ${weekReferrals} referrals in 7 days`,
            status: "open",
          },
        })
      }

      return {
        status: shouldFlag ? "flagged" : "completed",
        referredId: referredUserId,
        referrerId: referrer.id,
        referrerReward,
        refereeReward,
        boosted,
      }
    },
    { maxWait: 5_000, timeout: 15_000 }
  )

  // Milestones are best-effort and run after the payout commits so a
  // notification/push failure can never roll back the credits.
  if ((result.status === "completed" || result.status === "flagged") && result.referrerId) {
    try {
      await applyReferralMilestone(result.referrerId)
    } catch (err) {
      console.error("[referral-rewards] milestone failed", err)
    }
  }

  return result
}

async function applyReferralMilestone(referrerId: string) {
  const verifiedCount = await prisma.referral.count({
    where: { referrerId, rewardStatus: "completed" },
  })
  const milestone = verifiedCount >= 10 ? "PRIME" : verifiedCount >= 5 ? "PLUS" : null
  if (!milestone) return

  const notificationType = `referral_milestone_${milestone.toLowerCase()}`
  const seen = await prisma.notification.findFirst({
    where: { userId: referrerId, type: notificationType },
    select: { id: true },
  })
  if (seen) return

  const current = await prisma.user.findUnique({
    where: { id: referrerId },
    select: { tierExpiresAt: true },
  })
  if (!current) return

  const base = Math.max(Date.now(), current.tierExpiresAt?.getTime() ?? 0)
  await prisma.user.update({
    where: { id: referrerId },
    data: {
      tier: milestone as "PLUS" | "PRIME",
      tierExpiresAt: new Date(base + 31 * 24 * 60 * 60 * 1000),
    },
  })

  const { createNotification } = await import("@/lib/notifications")
  await createNotification({
    userId: referrerId,
    type: notificationType,
    title:
      milestone === "PRIME"
        ? "👑 10 verified invites — PRIME unlocked!"
        : "★ 5 verified invites — PLUS unlocked!",
    body: `your invite link did the work. 30 days of ${milestone.toLowerCase()} on the house.`,
    href: "/lair",
  }).catch(() => {})
}
