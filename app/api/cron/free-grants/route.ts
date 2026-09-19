import { NextRequest, NextResponse } from "next/server"
import { prisma } from "@/lib/prisma"
import { getEffectiveTier, getWeeklyBoostGrant, getMonthlyFreezeGrant, shouldGrantWeeklyBoost, shouldGrantMonthlyFreeze } from "@/lib/tier"

export const dynamic = "force-dynamic"

export async function GET(req: NextRequest) {
  const auth = req.headers.get("authorization")
  if (auth !== `Bearer ${process.env.CRON_SECRET}`) {
    return NextResponse.json({ error: "Unauthorized." }, { status: 401 })
  }

  const now = new Date()
  const weekStart = new Date(now)
  weekStart.setDate(now.getDate() - now.getDay())
  weekStart.setHours(0, 0, 0, 0)

  const monthStart = new Date(now.getFullYear(), now.getMonth(), 1)

  const users = await prisma.user.findMany({
    where: { tier: { not: "FREE" } },
    select: {
      id: true,
      tier: true,
      tierExpiresAt: true,
      lastFreeBoostGrant: true,
      lastFreeFreezeGrant: true,
    },
  })

  let weeklyBoostsGranted = 0
  let monthlyFreezesGranted = 0
  const notifications: { userId: string; type: string }[] = []

  for (const user of users) {
    const effectiveTier = getEffectiveTier(user)
    if (effectiveTier === "FREE") continue

    // Weekly boost grant
    if (shouldGrantWeeklyBoost(user)) {
      const count = getWeeklyBoostGrant(effectiveTier)
      if (count > 0) {
        await prisma.user.update({
          where: { id: user.id },
          data: {
            freeBoosts: { increment: count },
            freeBoostsWeekly: { increment: count },
            lastFreeBoostGrant: now,
          },
        })
        weeklyBoostsGranted += count
        notifications.push({ userId: user.id, type: "weekly_boost_grant" })
      }
    }

    // Monthly freeze grant (Prime only)
    if (shouldGrantMonthlyFreeze(user)) {
      const count = getMonthlyFreezeGrant(effectiveTier)
      if (count > 0) {
        await prisma.user.update({
          where: { id: user.id },
          data: {
            streakFreezeUntil: new Date(now.getTime() + 48 * 60 * 60 * 1000),
            freeStreakFreezeMonthly: { increment: count },
            lastFreeFreezeGrant: now,
          },
        })
        monthlyFreezesGranted += count
        notifications.push({ userId: user.id, type: "monthly_freeze_grant" })
      }
    }
  }

  // Create notifications in batch
  for (const n of notifications) {
    try {
      if (n.type === "weekly_boost_grant") {
        await prisma.notification.create({
          data: {
            userId: n.userId,
            type: "weekly_boost_grant",
            title: "Weekly boosts granted!",
            body: "Your free post boosts for this week are ready.",
            href: "/shop",
          },
        })
      } else if (n.type === "monthly_freeze_grant") {
        await prisma.notification.create({
          data: {
            userId: n.userId,
            type: "monthly_freeze_grant",
            title: "Monthly streak freeze granted!",
            body: "Your free streak freeze for this month is ready.",
            href: "/shop",
          },
        })
      }
    } catch {}
  }

  return NextResponse.json({
    weeklyBoostsGranted,
    monthlyFreezesGranted,
    processedUsers: users.length,
    checkedAt: now,
  })
}