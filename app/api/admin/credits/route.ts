import { NextRequest, NextResponse } from "next/server"
import { prisma } from "@/lib/prisma"
import { getCurrentUser } from "@/lib/getCurrentUser"
import { isAdmin } from "@/lib/getAdmin"
import { getTreasuryStats, mintCreditsAdmin, burnCreditsAdmin } from "@/lib/credits"

export async function GET(req: NextRequest) {
  const user = await getCurrentUser(req)
  if (!user || !isAdmin(req)) {
    return NextResponse.json({ error: "admin only" }, { status: 403 })
  }

  const { searchParams } = new URL(req.url)
  const action = searchParams.get("action")

  if (action === "treasury") {
    const stats = await getTreasuryStats()
    return NextResponse.json({ stats })
  }

  if (action === "payouts") {
    const status = searchParams.get("status") || "pending"
    const payouts = await prisma.creditPayout.findMany({
      where: { status: { in: status.split(",") } },
      include: { user: { select: { ghostId: true, email: true, tier: true } } },
      orderBy: { requestedAt: "desc" },
      take: 100,
    })
    return NextResponse.json({ payouts })
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
        creditsWithdrawn: true,
        kycStatus: true,
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
    return NextResponse.json({ success: true, ...result })
  }

  if (action === "burn") {
    const { userId, amount, reason } = body
    if (!userId || !amount || !reason) {
      return NextResponse.json({ error: "userId, amount, reason required" }, { status: 400 })
    }
    const result = await burnCreditsAdmin(userId, amount, reason, user.id)
    return NextResponse.json({ success: true, ...result })
  }

  if (action === "approve_payout") {
    // Withdrawals paused: approvals disabled (would mark payable). Reject
    // path below still works so pending users can be refunded.
    return NextResponse.json({ error: "withdrawals are currently paused. approval disabled." }, { status: 403 })
  }

  if (action === "reject_payout") {
    const { payoutId, reason } = body
    if (!payoutId) return NextResponse.json({ error: "payoutId required" }, { status: 400 })

    const payout = await prisma.creditPayout.findUnique({ where: { id: payoutId } })
    if (!payout) return NextResponse.json({ error: "payout not found" }, { status: 404 })

    // Refund credits to user
    await mintCreditsAdmin(payout.userId, payout.creditsAmount, `Payout rejected: ${reason || "Admin rejection"}`, user.id)

    await prisma.creditPayout.update({
      where: { id: payoutId },
      data: { status: "rejected", adminNotes: reason || "Rejected by admin" },
    })

    return NextResponse.json({ success: true })
  }

  return NextResponse.json({ error: "invalid action" }, { status: 400 })
}