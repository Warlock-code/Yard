import { NextRequest, NextResponse } from "next/server"
import { prisma } from "@/lib/prisma"
import { creditUser, CREDIT_CONFIG } from "@/lib/credits"
import { getEffectiveTier } from "@/lib/tier"

export const dynamic = "force-dynamic"

export async function GET(req: NextRequest) {
  const auth = req.headers.get("authorization")
  if (auth !== `Bearer ${process.env.CRON_SECRET}`) {
    return NextResponse.json({ error: "Unauthorized." }, { status: 401 })
  }

  const now = new Date()
  const isMonthEnd = now.getDate() === 1 // Run on 1st of month for previous month
  const isWeekEnd = now.getDay() === 1 // Run on Monday for previous week

  const results: Record<string, unknown[]> = { weekly: [], monthly: [] }

  const campuses = await prisma.user.findMany({
    where: { status: "ACTIVE" },
    select: { campus: true },
    distinct: ["campus"],
  })

  for (const { campus } of campuses) {
    if (isWeekEnd) {
      const weeklyRewards = await processWeeklyLeaderboard(campus, now)
      results.weekly.push(...weeklyRewards)
    }
    if (isMonthEnd) {
      const monthlyRewards = await processMonthlyLeaderboard(campus, now)
      results.monthly.push(...monthlyRewards)
    }
  }

  return NextResponse.json({ success: true, results })
}

async function processWeeklyLeaderboard(campus: string, now: Date) {
  const weekStart = new Date(now)
  weekStart.setDate(weekStart.getDate() - 7)
  weekStart.setHours(0, 0, 0, 0)

  const users = await prisma.user.findMany({
    where: { campus, status: "ACTIVE" },
    select: {
      id: true,
      ghostId: true,
      tier: true,
      posts: {
        where: { createdAt: { gte: weekStart } },
        select: { yeahs: true },
      },
      battleEntries: {
        where: { createdAt: { gte: weekStart } },
        select: { votes: true },
      },
    },
  })

  const ranked = users
    .map((u) => ({
      id: u.id,
      tier: u.tier,
      score: u.posts.reduce((s, p) => s + p.yeahs, 0) + u.battleEntries.reduce((s, e) => s + e.votes, 0),
    }))
    .filter((u) => u.score > 0)
    .sort((a, b) => b.score - a.score)
    .slice(0, 3)

  const rewards: Record<string, unknown>[] = []

  for (let i = 0; i < ranked.length; i++) {
    const user = ranked[i]
    const tier = user.tier
    const multiplier = CREDIT_CONFIG.TIER_MULTIPLIER[tier as keyof typeof CREDIT_CONFIG.TIER_MULTIPLIER]?.earn || 1
    
    let reward = 0
    if (i === 0) reward = CREDIT_CONFIG.EARN.LEADERBOARD_WEEKLY_1
    else if (i === 1) reward = CREDIT_CONFIG.EARN.LEADERBOARD_WEEKLY_2
    else if (i === 2) reward = CREDIT_CONFIG.EARN.LEADERBOARD_WEEKLY_3

    const finalReward = Math.round(reward * multiplier)
    
    if (finalReward > 0) {
      await creditUser(user.id, "LEADERBOARD", finalReward, `weekly_${campus}`, {
        campus,
        rank: i + 1,
        period: "weekly",
        score: user.score,
        tier,
      })
      rewards.push({ userId: user.id, rank: i + 1, reward: finalReward, campus })
    }
  }

  return rewards
}

async function processMonthlyLeaderboard(campus: string, now: Date) {
  const monthStart = new Date(now.getFullYear(), now.getMonth() - 1, 1)
  const monthEnd = new Date(now.getFullYear(), now.getMonth(), 1)

  const users = await prisma.user.findMany({
    where: { campus, status: "ACTIVE" },
    select: {
      id: true,
      ghostId: true,
      tier: true,
      posts: {
        where: { createdAt: { gte: monthStart, lt: monthEnd } },
        select: { yeahs: true },
      },
      battleEntries: {
        where: { createdAt: { gte: monthStart, lt: monthEnd } },
        select: { votes: true },
      },
    },
  })

  const ranked = users
    .map((u) => ({
      id: u.id,
      tier: u.tier,
      score: u.posts.reduce((s, p) => s + p.yeahs, 0) + u.battleEntries.reduce((s, e) => s + e.votes, 0),
    }))
    .filter((u) => u.score > 0)
    .sort((a, b) => b.score - a.score)
    .slice(0, 3)

  const rewards: Record<string, unknown>[] = []

  for (let i = 0; i < ranked.length; i++) {
    const user = ranked[i]
    const tier = user.tier
    const multiplier = CREDIT_CONFIG.TIER_MULTIPLIER[tier as keyof typeof CREDIT_CONFIG.TIER_MULTIPLIER]?.earn || 1
    
    let reward = 0
    if (i === 0) reward = CREDIT_CONFIG.EARN.LEADERBOARD_MONTHLY_1
    else if (i === 1) reward = CREDIT_CONFIG.EARN.LEADERBOARD_MONTHLY_2
    else if (i === 2) reward = CREDIT_CONFIG.EARN.LEADERBOARD_MONTHLY_3

    const finalReward = Math.round(reward * multiplier)
    
    if (finalReward > 0) {
      await creditUser(user.id, "LEADERBOARD", finalReward, `monthly_${campus}`, {
        campus,
        rank: i + 1,
        period: "monthly",
        score: user.score,
        tier,
      })
      rewards.push({ userId: user.id, rank: i + 1, reward: finalReward, campus })
    }
  }

  return rewards
}