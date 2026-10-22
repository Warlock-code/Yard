import { NextRequest, NextResponse } from "next/server"
import { prisma } from "@/lib/prisma"
import { getCurrentUser } from "@/lib/getCurrentUser"
import { REFERRAL_CONFIG } from "@/lib/referral-config"
import { CREDIT_CONFIG } from "@/lib/credits"
import { completeReferralReward } from "@/lib/referral-rewards"

export async function GET(req: NextRequest) {
  const user = await getCurrentUser(req)
  if (!user) return NextResponse.json({ error: "not authenticated." }, { status: 401 })

  // Self-heal the backlog created by the old verify-email-only payout flow.
  // Pending referrals whose referred user is already verified are paid now;
  // completeReferralReward is idempotent, so concurrent signup/verify payouts
  // and repeated stats loads cannot double-credit anyone.
  try {
    const pending = await prisma.referral.findMany({
      where: {
        referrerId: user.id,
        status: "pending",
        rewardStatus: "none",
        referred: { is: { emailVerified: true } },
      },
      select: { referredId: true },
      orderBy: { createdAt: "asc" },
      // Keep this GET fast; scripts/backfill-referral-rewards.ts is available
      // for larger historical backlogs.
      take: 10,
    })
    for (const referral of pending) {
      try {
        await completeReferralReward(referral.referredId)
      } catch (err) {
        console.error("[referral/stats] retroactive payout failed", {
          referredId: referral.referredId,
          err,
        })
      }
    }
  } catch (err) {
    // Stats must still render if the repair scan fails.
    console.error("[referral/stats] retroactive payout scan failed", err)
  }

  const [referrals, stats] = await Promise.all([
    prisma.referral.findMany({
      where: { referrerId: user.id },
      include: {
        referred: {
          select: { ghostId: true, avatarEmoji: true, createdAt: true, emailVerified: true },
        },
      },
      orderBy: { createdAt: "desc" },
    }),
    prisma.user.findUnique({
      where: { id: user.id },
      select: { referralCount: true, ghostCoins: true, inviteCode: true },
    }),
  ])

  const totalReferrals = referrals.length
  // "Verified" here means completed *and paid*. Flagged referrals and
  // daily-cap rows (rewardStatus "none") must not count toward milestones.
  const verifiedReferrals = referrals.filter(
    (r) => r.status === "completed" && r.rewardStatus === "completed"
  ).length
  const flaggedReferrals = referrals.filter((r) => r.rewardStatus === "flagged").length
  const pendingReferrals = referrals.filter((r) => r.status === "pending" && r.rewardStatus === "none").length
  const creditsEarned = referrals.reduce((sum, r) => sum + (r.rewardAmount || 0), 0)

  const referralLink = `${process.env.NEXT_PUBLIC_APP_URL || "https://yardapp.me"}/join?ref=${stats?.inviteCode}`

  // Milestone progress (5 refs → free PLUS 30d, 10 → free PRIME 30d).
  // Fail-open: stats must render even if counting fails.
  const milestones: { verified: number; plusAt: number; primeAt: number; next: { tier: string; at: number; remaining: number } | null } = {
    verified: verifiedReferrals,
    plusAt: 5,
    primeAt: 10,
    next: null,
  }
  try {
    milestones.next =
      verifiedReferrals >= 10
        ? null
        : verifiedReferrals >= 5
          ? { tier: "PRIME", at: 10, remaining: 10 - verifiedReferrals }
          : { tier: "PLUS", at: 5, remaining: 5 - verifiedReferrals }
  } catch {
    // keep defaults
  }

  return NextResponse.json({
    code: stats?.inviteCode,
    referralLink,
    milestones,
    stats: {
      totalReferrals,
      verifiedReferrals,
      flaggedReferrals,
      pendingReferrals,
      creditsEarned,
      dailyCap: REFERRAL_CONFIG.DAILY_CAP,
      // Displayed rewards = actual payout values (EARN), not the legacy
      // REFERRAL_CONFIG figures.
      referrerReward: CREDIT_CONFIG.EARN.REFERRAL_REFERRER,
      refereeReward: CREDIT_CONFIG.EARN.REFERRAL_REFEREE,
    },
    referrals: referrals.map((r) => ({
      id: r.id,
      ghostId: r.referred.ghostId,
      avatarEmoji: r.referred.avatarEmoji,
      joinedAt: r.referred.createdAt,
      emailVerified: r.referred.emailVerified,
      status: r.status,
      rewardStatus: r.rewardStatus,
      rewardAmount: r.rewardAmount,
      completedAt: r.completedAt,
    })),
  })
}