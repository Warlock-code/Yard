import { NextRequest, NextResponse } from "next/server"
import { prisma } from "@/lib/prisma"
import { getMaxBoostExpiry } from "@/lib/boost"

export const dynamic = "force-dynamic"

export async function GET(req: NextRequest) {
  const auth = req.headers.get("authorization")
  if (auth !== `Bearer ${process.env.CRON_SECRET}`) {
    return NextResponse.json({ error: "unauthorized." }, { status: 401 })
  }

  const now = new Date()
  const results: Record<string, unknown> = {}

  // 1. Tier expiry (with 3-day grace period)
  const graceCutoff = new Date(now.getTime() - 3 * 24 * 60 * 60 * 1000)
  const expiredUsers = await prisma.user.findMany({
    where: { tier: { not: "FREE" }, tierExpiresAt: { lte: graceCutoff } },
    select: { id: true, tier: true, tierExpiresAt: true, email: true },
  })

  let downgraded = 0
  for (const u of expiredUsers) {
    await prisma.user.update({
      where: { id: u.id },
      data: { tier: "FREE", tierExpiresAt: null },
    })
    try {
      await prisma.notification.create({
        data: {
          userId: u.id,
          type: "tier_expired",
          title: "Your Yard tier ended",
          body: `Your ${u.tier} expired. Renew at yardapp.me/upgrade to keep Prime perks & payouts.`,
          href: "/upgrade",
        },
      })
    } catch {}
    downgraded++
  }

  const soonExpiring = await prisma.user.findMany({
    where: {
      tier: { not: "FREE" },
      tierExpiresAt: { gte: now, lte: new Date(now.getTime() + 3 * 24 * 60 * 60 * 1000) },
    },
    select: { id: true },
  })

  results.tierExpiry = { downgraded, soonExpiring: soonExpiring.length }

  // 2. Boost expiry
  const maxExpiry = getMaxBoostExpiry(now)

  const expired = await prisma.post.updateMany({
    where: {
      boosted: true,
      OR: [{ boostedUntil: { lte: now } }, { boostedUntil: null }],
    },
    data: { boosted: false, boostedUntil: null },
  })

  const capped = await prisma.post.updateMany({
    where: {
      boosted: true,
      boostedUntil: { gt: maxExpiry },
    },
    data: { boostedUntil: maxExpiry },
  })

  results.boostExpiry = { expired: expired.count, capped: capped.count, checkedAt: now }

  // 3. Streak breaker: anyone with a live streak who missed yesterday (and
  // has no active freeze) drops to 0, stamped restorable for 48h. Frozen
  // users are skipped entirely — the freeze bridges the gap.
  const todayStart = new Date(now)
  todayStart.setHours(0, 0, 0, 0)
  const yesterdayStart = new Date(todayStart)
  yesterdayStart.setDate(yesterdayStart.getDate() - 1)

  const lapsed = await prisma.user.findMany({
    where: {
      streakCount: { gt: 0 },
      AND: [
        { OR: [{ lastPostedAt: { lt: yesterdayStart } }, { lastPostedAt: null }] },
        { OR: [{ streakFreezeUntil: null }, { streakFreezeUntil: { lte: now } }] },
      ],
    },
    select: { id: true, streakCount: true },
  })

  let streaksBroken = 0
  const BATCH = 100
  for (let i = 0; i < lapsed.length; i += BATCH) {
    const chunk = lapsed.slice(i, i + BATCH)
    await prisma.$transaction(
      chunk.map((u) =>
        prisma.user.update({
          where: { id: u.id },
          data: { lastStreakCount: u.streakCount, streakBrokenAt: now, streakCount: 0 },
        })
      )
    )
    streaksBroken += chunk.length
  }

  results.streakBreak = { broken: streaksBroken, checkedAt: now }

  return NextResponse.json({ success: true, ...results })
}