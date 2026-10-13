import { NextRequest, NextResponse } from "next/server"
import { prisma } from "@/lib/prisma"
import { getCurrentUser } from "@/lib/getCurrentUser"
import { isAdmin } from "@/lib/getAdmin"
import { getTreasuryStats, mintCreditsAdmin, burnCreditsAdmin, refundCreditsAdmin } from "@/lib/credits"

async function trackFeatureEventSafe(userId: string, type: string, metadata: Record<string, unknown>) {
  try {
    const { trackFeatureEvent } = await import("@/lib/credits")
    await trackFeatureEvent({ userId, type, metadata })
  } catch {}
}

export async function GET(req: NextRequest) {
  const user = await getCurrentUser(req)
  if (!user || !isAdmin(req)) {
    return NextResponse.json({ error: "admin only" }, { status: 403 })
  }

  const { searchParams } = new URL(req.url)
  const action = searchParams.get("action")

  // Analytics beacon — live-safe, never breaks the main flow.
  try {
    await prisma.analyticsEvent.create({
      data: { userId: user.id, type: "admin_credits_view", metadata: { action: action ?? "none" } },
    }).catch(() => {})
  } catch {}

  if (action === "treasury") {
    const stats = await getTreasuryStats()
    return NextResponse.json({ stats })
  }

  if (action === "users") {
    const users = await prisma.user.findMany({
      where: { creditsBalance: { gt: 0 } },
      select: {
        id: true,
        ghostId: true,
        email: true,
        tier: true,
        creditsBalance: true,
        creditsEarned: true,
        creditsPurchased: true,
        createdAt: true,
      },
      orderBy: { creditsBalance: "desc" },
      take: 100,
    })
    return NextResponse.json({ users })
  }

  if (action === "top_referrers") {
    const days = Math.min(Math.max(Number(searchParams.get("days")) || 7, 1), 90)
    const since = new Date(Date.now() - days * 24 * 60 * 60 * 1000)
    // Verified = reward paid out; totals include pending. Two groupBys,
    // merged in code — no schema change needed for contests.
    const [verified, totals] = await Promise.all([
      prisma.referral.groupBy({
        by: ["referrerId"],
        where: { rewardStatus: "completed", createdAt: { gte: since } },
        _count: { _all: true },
      }),
      prisma.referral.groupBy({
        by: ["referrerId"],
        where: { createdAt: { gte: since } },
        _count: { _all: true },
      }),
    ])
    const totalById = new Map(totals.map((t) => [t.referrerId, t._count._all]))
    const ranked = verified
      .map((v) => ({ referrerId: v.referrerId, verified: v._count._all, total: totalById.get(v.referrerId) ?? v._count._all }))
      .sort((a, b) => b.verified - a.verified)
      .slice(0, 10)
    const users = await prisma.user.findMany({
      where: { id: { in: ranked.map((r) => r.referrerId) } },
      select: { id: true, ghostId: true, campus: true, tier: true },
    })
    const byId = new Map(users.map((u) => [u.id, u]))
    return NextResponse.json({
      leaders: ranked.map((r) => ({
        ...r,
        ghostId: byId.get(r.referrerId)?.ghostId ?? "ghost",
        campus: byId.get(r.referrerId)?.campus ?? "",
        tier: byId.get(r.referrerId)?.tier ?? "FREE",
      })),
      days,
    })
  }

  if (action === "spend_stats") {
    // Average credit spend per user — for the Insights chart.
    // Spend = CreditTransaction amount < 0 (excludes MISSED_EARNING shadows).
    const days = Math.min(Math.max(Number(searchParams.get("days")) || 30, 1), 90)
    const since = new Date(Date.now() - days * 24 * 60 * 60 * 1000)
    const dayKey = (d: Date) => d.toISOString().slice(0, 10)
    const dayLabels: string[] = []
    for (let i = days - 1; i >= 0; i--) {
      dayLabels.push(dayKey(new Date(Date.now() - i * 24 * 60 * 60 * 1000)))
    }

    const [byType, totalUsers, spendRows] = await Promise.all([
      prisma.creditTransaction.groupBy({
        by: ["type"],
        where: { amount: { lt: 0 }, createdAt: { gte: since }, NOT: { type: "MISSED_EARNING" } },
        _sum: { amount: true },
        _count: { _all: true },
      }),
      prisma.user.count(),
      prisma.creditTransaction.findMany({
        where: { amount: { lt: 0 }, createdAt: { gte: since }, NOT: { type: "MISSED_EARNING" } },
        select: { amount: true, type: true, userId: true, createdAt: true },
        orderBy: { createdAt: "desc" },
        take: 20000,
      }),
    ])

    const byDayMap = new Map<string, { total: number; count: number }>(
      dayLabels.map((d) => [d, { total: 0, count: 0 }])
    )
    const spenders = new Set<string>()
    let totalSpent = 0
    for (const r of spendRows) {
      const spent = Math.abs(r.amount)
      totalSpent += spent
      spenders.add(r.userId)
      const k = dayKey(r.createdAt)
      const slot = byDayMap.get(k)
      if (slot) {
        slot.total += spent
        slot.count += 1
      }
    }

    const byDay = dayLabels.map((day) => ({
      day,
      total: byDayMap.get(day)?.total ?? 0,
      count: byDayMap.get(day)?.count ?? 0,
    }))
    const byTypeSorted = byType
      .map((t) => ({ type: t.type, total: Math.abs(t._sum.amount ?? 0), count: t._count._all }))
      .sort((a, b) => b.total - a.total)

    const denomDays = days || 1
    const denomUsers = totalUsers || 1
    return NextResponse.json({
      days,
      totalSpent,
      totalUsers,
      activeSpenders: spenders.size,
      avgPerDay: Number((totalSpent / denomDays).toFixed(1)),
      avgPerUserPerDay: Number((totalSpent / denomUsers / denomDays).toFixed(2)),
      avgPerSpenderPerDay: spenders.size > 0 ? Number((totalSpent / spenders.size / denomDays).toFixed(2)) : 0,
      byType: byTypeSorted,
      byDay,
    })
  }

  if (action === "feature_events") {
    // What converts: counts per tracked feature event in the window.
    const days = Math.min(Math.max(Number(searchParams.get("days")) || 30, 1), 90)
    const since = new Date(Date.now() - days * 24 * 60 * 60 * 1000)
    try {
      const grouped = await prisma.analyticsEvent.groupBy({
        by: ["type"],
        where: { createdAt: { gte: since }, NOT: { type: { in: ["page_view", "heartbeat", "session_start", "session_end"] } } },
        _count: { _all: true },
      })
      return NextResponse.json({
        days,
        events: grouped.map((g) => ({ type: g.type, count: g._count._all })).sort((a, b) => b.count - a.count),
      })
    } catch {
      return NextResponse.json({ days, events: [] })
    }
  }

  return NextResponse.json({ error: "invalid action" }, { status: 400 })
}

export async function POST(req: NextRequest) {
  const user = await getCurrentUser(req)
  if (!user || !isAdmin(req)) {
    return NextResponse.json({ error: "admin only" }, { status: 403 })
  }

  const body = await req.json().catch(() => ({}))
  const { action } = body

  if (action === "mint") {
    const { userId, amount, reason } = body
    if (!userId || !amount || !reason) {
      return NextResponse.json({ error: "userId, amount, reason required" }, { status: 400 })
    }
    const result = await mintCreditsAdmin(userId, amount, reason, user.id)
    try {
      await prisma.analyticsEvent.create({
        data: { userId: user.id, type: "admin_credits_adjust", metadata: { action: "mint", targetId: userId, amount } },
      }).catch(() => {})
    } catch {}
    return NextResponse.json({ success: true, ...result })
  }

  if (action === "burn") {
    const { userId, amount, reason } = body
    if (!userId || !amount || !reason) {
      return NextResponse.json({ error: "userId, amount, reason required" }, { status: 400 })
    }
    const result = await burnCreditsAdmin(userId, amount, reason, user.id)
    try {
      await prisma.analyticsEvent.create({
        data: { userId: user.id, type: "admin_credits_adjust", metadata: { action: "burn", targetId: userId, amount } },
      }).catch(() => {})
    } catch {}
    return NextResponse.json({ success: true, ...result })
  }

  if (action === "refund_credits") {
    // Manual credit refund: returns spendable credits to a user via an
    // ADMIN_REFUND CreditTransaction row — in-app only, never cash.
    const { userId, amount, reason } = body
    if (!userId || !amount || !reason) {
      return NextResponse.json({ error: "userId, amount, reason required" }, { status: 400 })
    }
    const result = await refundCreditsAdmin(userId, amount, reason, user.id)
    try {
      await prisma.analyticsEvent.create({
        data: { userId: user.id, type: "admin_credits_adjust", metadata: { action: "refund_credits", targetId: userId, amount } },
      }).catch(() => {})
    } catch {}
    return NextResponse.json({ success: true, ...result })
  }

  if (action === "refund") {
    // Paystack refund path (manual): a successful charge gets its credits
    // clawed back best-effort and the transaction marked refunded — no
    // silent money, everything audited via reason. Never auto-touches bank.
    const { reference, reason } = body
    if (!reference || !reason) {
      return NextResponse.json({ error: "reference, reason required" }, { status: 400 })
    }
    const tx = await prisma.transaction.findUnique({ where: { reference } })
    if (!tx) return NextResponse.json({ error: "transaction not found" }, { status: 404 })
    if (tx.status === "refunded") return NextResponse.json({ success: true, alreadyRefunded: true })
    if (tx.status !== "success") {
      await prisma.transaction.update({ where: { reference }, data: { status: "failed" } }).catch(() => {})
      return NextResponse.json({ success: true, voided: true })
    }
    const meta = (tx.metadata ?? {}) as { credits?: unknown; packId?: unknown; bundle?: unknown }
    const credits = typeof meta.credits === "number" && Number.isSafeInteger(meta.credits) ? meta.credits : 0
    if ((tx.kind === "credits" || tx.kind === "bundle_plus" || tx.kind === "bundle_prime") && credits > 0) {
      try {
        await burnCreditsAdmin(tx.userId, credits, `Refund ${reference}: ${reason}`, user.id)
      } catch (err) {
        return NextResponse.json(
          { error: err instanceof Error ? err.message : "user already spent the credits — adjust manually." },
          { status: 400 }
        )
      }
    }
    await prisma.transaction.update({
      where: { reference },
      data: { status: "refunded", metadata: { ...(meta as Record<string, unknown>), refundReason: reason, refundedBy: user.id, refundedAt: new Date().toISOString() } },
    }).catch(() => {})
    await trackFeatureEventSafe(user.id, "refund", { reference, kind: tx.kind })
    return NextResponse.json({ success: true })
  }

  return NextResponse.json({ error: "invalid action" }, { status: 400 })
}