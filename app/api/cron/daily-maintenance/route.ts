import { NextRequest, NextResponse } from "next/server"
import { prisma } from "@/lib/prisma"
import { getMaxBoostExpiry } from "@/lib/boost"
import { createNotification } from "@/lib/notifications"

export const dynamic = "force-dynamic"

export async function GET(req: NextRequest) {
  const auth = req.headers.get("authorization")
  if (auth !== `Bearer ${process.env.CRON_SECRET}`) {
    return NextResponse.json({ error: "unauthorized." }, { status: 401 })
  }

  const now = new Date()
  const results: Record<string, unknown> = {}

  // 1. Tier expiry.
  // Paid users get a 3-day grace period. Trial users (paid tier, never paid)
  // end strictly at expiry — no grace — with countdown pushes at 3d and 1d.
  const graceCutoff = new Date(now.getTime() - 3 * 24 * 60 * 60 * 1000)
  const expiredUsers = await prisma.user.findMany({
    where: { tier: { not: "FREE" }, tierExpiresAt: { lte: graceCutoff } },
    select: { id: true, tier: true, tierExpiresAt: true, email: true },
  })

  // Trial users past expiry (even within grace) end immediately.
  const pastExpiryTrials = await prisma.user.findMany({
    where: { tier: { not: "FREE" }, tierExpiresAt: { lte: now, gt: graceCutoff } },
    select: { id: true, tier: true },
  })
  const paidSubUserIds = new Set(
    (
      await prisma.transaction.findMany({
        where: {
          userId: { in: pastExpiryTrials.map((u) => u.id) },
          kind: { in: ["plus", "prime"] },
          status: "success",
        },
        select: { userId: true },
      })
    ).map((t) => t.userId)
  )
  const trialEnded = pastExpiryTrials.filter((u) => !paidSubUserIds.has(u.id))

  let downgraded = 0
  let trialsEnded = 0
  async function downgrade(userId: string, tier: string, trial: boolean) {
    await prisma.user.update({
      where: { id: userId },
      data: { tier: "FREE", tierExpiresAt: null },
    })
    // Trial end goes out as push + in-app + live socket (conversion moment).
    // Paid expiry keeps the existing in-app-only behavior.
    if (trial) {
      await createNotification({
        userId,
        type: "trial_ended",
        title: "your plus trial ended",
        body: "your free plus week is over — your checkmark and perks are gone. keep them for GHS 10/mo.",
        href: "/upgrade",
      }).catch(() => {})
      return
    }
    try {
      await prisma.notification.create({
        data: {
          userId,
          type: "tier_expired",
          title: "Your Yard tier ended",
          body:
            tier === "PRIME"
              ? "Your PRIME expired. Renew at yardapp.me/upgrade to keep gold perks & earnings."
              : "Your Plus expired. Renew at yardapp.me/upgrade to keep your perks.",
          href: "/upgrade",
        },
      })
    } catch {}
  }

  for (const u of expiredUsers) {
    await downgrade(u.id, u.tier, false)
    downgraded++
  }
  for (const u of trialEnded) {
    await downgrade(u.id, u.tier, true)
    trialsEnded++
  }

  // Trial countdown: 3 days and 1 day left (deduped per day).
  const trialCountdownSent = { d3: 0, d1: 0 }
  try {
    const upcomingTrials = await prisma.user.findMany({
      where: {
        tier: { not: "FREE" },
        tierExpiresAt: { gt: now, lte: new Date(now.getTime() + 3 * 24 * 60 * 60 * 1000 + 60_000) },
      },
      select: { id: true, tierExpiresAt: true },
      take: 500,
    })
    if (upcomingTrials.length > 0) {
      const paidIds = new Set(
        (
          await prisma.transaction.findMany({
            where: {
              userId: { in: upcomingTrials.map((u) => u.id) },
              kind: { in: ["plus", "prime"] },
              status: "success",
            },
            select: { userId: true },
          })
        ).map((t) => t.userId)
      )
      const since = new Date(now.getTime() - 20 * 60 * 60 * 1000)
      for (const u of upcomingTrials) {
        if (paidIds.has(u.id) || !u.tierExpiresAt) continue
        const daysLeft = Math.ceil((u.tierExpiresAt.getTime() - now.getTime()) / (24 * 60 * 60 * 1000))
        const type = daysLeft === 3 ? "trial_3d_left" : daysLeft === 1 ? "trial_1d_left" : null
        if (!type) continue
        const already = await prisma.notification.findFirst({
          where: { userId: u.id, type, createdAt: { gte: since } },
          select: { id: true },
        })
        if (already) continue
        try {
          // Push + in-app + live socket.
          await createNotification({
            userId: u.id,
            type,
            title: daysLeft === 3 ? "3 days of plus left" : "plus ends tomorrow",
            body:
              daysLeft === 3
                ? "your free plus trial has 3 days left — edits, blue check, weekly boost. keep it all for GHS 10/mo."
                : "last day of free plus — your checkmark disappears tomorrow. lock it in for GHS 10/mo.",
            href: "/upgrade",
          })
          if (daysLeft === 3) trialCountdownSent.d3++
          else trialCountdownSent.d1++
        } catch {}
      }
    }
  } catch (e) {
    console.error("[daily-maintenance] trial countdown failed", e)
  }

  const soonExpiring = await prisma.user.findMany({
    where: {
      tier: { not: "FREE" },
      tierExpiresAt: { gte: now, lte: new Date(now.getTime() + 3 * 24 * 60 * 60 * 1000) },
    },
    select: { id: true },
  })

  results.tierExpiry = { downgraded, trialsEnded, trialCountdownSent, soonExpiring: soonExpiring.length }

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