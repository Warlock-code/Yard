import { NextRequest, NextResponse } from "next/server"
import { prisma } from "@/lib/prisma"
import { getCurrentUser } from "@/lib/getCurrentUser"

const REFERRAL_REWARDS = {
  FIRST: { ghostCoins: 500, streakFreezeDays: 7, cosmetic: "ghost_glow" },
  FIFTH: { ghostCoins: 1000, streakFreezeDays: 14, cosmetic: "golden_ghost" },
  TENTH: { ghostCoins: 2500, streakFreezeDays: 30, cosmetic: "diamond_ghost" },
}

async function grantReferralReward(userId: string, referralCount: number) {
  let reward: { ghostCoins: number; streakFreezeDays: number; cosmetic: string } | null = null

  if (referralCount === 1) reward = REFERRAL_REWARDS.FIRST
  else if (referralCount === 5) reward = REFERRAL_REWARDS.FIFTH
  else if (referralCount === 10) reward = REFERRAL_REWARDS.TENTH

  if (!reward) return null

  const freezeUntil = new Date()
  freezeUntil.setDate(freezeUntil.getDate() + reward.streakFreezeDays)

  await prisma.$transaction([
    prisma.user.update({
      where: { id: userId },
      data: {
        ghostCoins: { increment: reward.ghostCoins },
        streakFreezeUntil: {
          set: freezeUntil > new Date() ? freezeUntil : new Date(Date.now() + reward.streakFreezeDays * 24 * 60 * 60 * 1000),
        },
        ownedCosmetics: {
          push: reward.cosmetic,
        },
      },
    }),
    prisma.referral.updateMany({
      where: { referrerId: userId, rewardAmount: 0 },
      data: { rewardAmount: reward.ghostCoins },
    }),
  ])

  return reward
}

export async function GET(req: NextRequest) {
  const user = await getCurrentUser(req)
  if (!user) return NextResponse.json({ error: "Not authenticated." }, { status: 401 })

  const [referrals, stats] = await Promise.all([
    prisma.referral.findMany({
      where: { referrerId: user.id },
      include: {
        referred: {
          select: { ghostId: true, avatarEmoji: true, createdAt: true },
        },
      },
      orderBy: { createdAt: "desc" },
    }),
    prisma.user.findUnique({
      where: { id: user.id },
      select: { referralCount: true, ghostCoins: true, streakFreezeUntil: true, ownedCosmetics: true },
    }),
  ])

  const pendingRewards = referrals.filter((r) => r.rewardAmount === 0).length
  const referralCount = stats?.referralCount ?? 0
  const nextMilestone = referralCount === 0 ? 1 : referralCount < 5 ? 5 : referralCount < 10 ? 10 : null

  return NextResponse.json({
    referrals: referrals.map((r) => ({
      id: r.id,
      ghostId: r.referred.ghostId,
      avatarEmoji: r.referred.avatarEmoji,
      joinedAt: r.referred.createdAt,
      rewardGiven: r.rewardAmount > 0,
    })),
    stats: {
      totalReferrals: referralCount,
      ghostCoins: stats?.ghostCoins || 0,
      hasActiveStreakFreeze: stats?.streakFreezeUntil ? stats.streakFreezeUntil > new Date() : false,
      ownedCosmetics: stats?.ownedCosmetics || [],
      pendingRewards,
      nextMilestone,
    },
    milestones: {
      1: REFERRAL_REWARDS.FIRST,
      5: REFERRAL_REWARDS.FIFTH,
      10: REFERRAL_REWARDS.TENTH,
    },
  })
}

export async function POST(req: NextRequest) {
  const user = await getCurrentUser(req)
  if (!user) return NextResponse.json({ error: "Not authenticated." }, { status: 401 })

  const body = await req.json().catch(() => ({}))
  const { action } = body

  if (action === "claim") {
    const stats = await prisma.user.findUnique({
      where: { id: user.id },
      select: { referralCount: true },
    })

    if (!stats) return NextResponse.json({ error: "User not found." }, { status: 404 })

    const reward = await grantReferralReward(user.id, stats.referralCount ?? 0)
    if (!reward) {
      return NextResponse.json({ error: "No rewards available to claim." }, { status: 400 })
    }

    return NextResponse.json({ reward, message: "Reward claimed!" })
  }

  return NextResponse.json({ error: "Invalid action." }, { status: 400 })
}