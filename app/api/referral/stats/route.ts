import { NextRequest, NextResponse } from "next/server"
import { prisma } from "@/lib/prisma"
import { getCurrentUser } from "@/lib/getCurrentUser"
import { REFERRAL_CONFIG } from "@/lib/referral-config"

export async function GET(req: NextRequest) {
  const user = await getCurrentUser(req)
  if (!user) return NextResponse.json({ error: "Not authenticated." }, { status: 401 })

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
  const verifiedReferrals = referrals.filter((r) => r.rewardStatus === "completed").length
  const flaggedReferrals = referrals.filter((r) => r.rewardStatus === "flagged").length
  const pendingReferrals = referrals.filter((r) => r.status === "pending" && r.rewardStatus === "none").length
  const coinsEarned = referrals.reduce((sum, r) => sum + (r.rewardAmount || 0), 0)

  const referralLink = `${process.env.NEXT_PUBLIC_APP_URL || "https://yardapp.me"}/join?ref=${stats?.inviteCode}`

  return NextResponse.json({
    code: stats?.inviteCode,
    referralLink,
    stats: {
      totalReferrals,
      verifiedReferrals,
      flaggedReferrals,
      pendingReferrals,
      coinsEarned,
      dailyCap: REFERRAL_CONFIG.DAILY_CAP,
      referrerReward: REFERRAL_CONFIG.REFERRER_REWARD,
      refereeReward: REFERRAL_CONFIG.REFEREE_REWARD,
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