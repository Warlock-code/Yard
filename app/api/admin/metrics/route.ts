import { NextRequest, NextResponse } from "next/server"
import { prisma } from "@/lib/prisma"
import { isAdmin } from "@/lib/getAdmin"

export const dynamic = "force-dynamic"

function dayOf(d: Date): string {
  return d.toISOString().slice(0, 10)
}

export async function GET(req: NextRequest) {
  if (!isAdmin(req)) return NextResponse.json({ error: "Not authorized." }, { status: 403 })

  const raw = Number(req.nextUrl.searchParams.get("range") ?? 30)
  const range = Number.isFinite(raw) ? Math.min(90, Math.max(1, Math.floor(raw))) : 30

  // Ascending UTC day labels for the window; all per-day maps start zero-filled.
  const days: string[] = []
  for (let i = range - 1; i >= 0; i--) {
    days.push(dayOf(new Date(Date.now() - i * 24 * 60 * 60 * 1000)))
  }
  const start = new Date(days[0] + "T00:00:00.000Z")
  const windowFilter = { gte: start }

  // All heavy reads are capped to the `range`-day window; lifetime counts mirror the stats route.
  const [
    posts,
    comments,
    votes,
    checkoutStarted,
    paidCount,
    userCount,
    plusCount,
    primeCount,
    revenueAgg,
    paidOutAgg,
    payers,
  ] = await Promise.all([
    prisma.post.findMany({ where: { createdAt: windowFilter }, select: { userId: true, createdAt: true } }),
    prisma.comment.findMany({ where: { createdAt: windowFilter }, select: { userId: true, createdAt: true } }),
    prisma.postVote.findMany({ where: { createdAt: windowFilter }, select: { userId: true, createdAt: true } }),
    prisma.transaction.count({ where: { status: "pending", createdAt: windowFilter } }),
    prisma.transaction.count({ where: { status: "success", createdAt: windowFilter } }),
    prisma.user.count(),
    prisma.user.count({ where: { tier: "PLUS" } }),
    prisma.user.count({ where: { tier: "PRIME" } }),
    prisma.transaction.aggregate({ where: { status: "success", createdAt: windowFilter }, _sum: { amount: true } }),
    prisma.payout.aggregate({ where: { status: "paid", requestedAt: windowFilter }, _sum: { amount: true } }),
    prisma.transaction.findMany({
      where: { status: "success", createdAt: windowFilter },
      select: { userId: true },
      distinct: ["userId"],
    }),
  ])

  const dauByDay = new Map<string, Set<string>>(days.map((d) => [d, new Set<string>()]))
  const postsByDay = new Map<string, number>(days.map((d) => [d, 0]))
  const paywallByDay = new Map<string, number>(days.map((d) => [d, 0]))

  for (const p of posts) {
    const day = dayOf(p.createdAt)
    if (postsByDay.has(day)) postsByDay.set(day, (postsByDay.get(day) ?? 0) + 1)
    dauByDay.get(day)?.add(p.userId)
  }
  for (const c of comments) dauByDay.get(dayOf(c.createdAt))?.add(c.userId)
  for (const v of votes) dauByDay.get(dayOf(v.createdAt))?.add(v.userId)

  // PaywallHit table may not exist yet (migration pending) — fall back to zeros.
  let hits = 0
  try {
    const paywallHits = await prisma.paywallHit.findMany({
      where: { createdAt: windowFilter },
      select: { createdAt: true },
    })
    for (const h of paywallHits) {
      const day = dayOf(h.createdAt)
      if (paywallByDay.has(day)) {
        paywallByDay.set(day, (paywallByDay.get(day) ?? 0) + 1)
        hits += 1
      }
    }
  } catch {
    // Table missing — keep the zero-filled series and hits = 0.
  }

  const plusRate = userCount > 0 ? plusCount / userCount : 0
  const primeRate = userCount > 0 ? primeCount / userCount : 0
  const paidRate = userCount > 0 ? (plusCount + primeCount) / userCount : 0

  const revenuePesewas = revenueAgg._sum.amount ?? 0
  const paidOutPesewas = paidOutAgg._sum.amount ?? 0
  const arppuPesewas = payers.length > 0 ? revenuePesewas / payers.length : 0
  const payoutRatio = revenuePesewas > 0 ? paidOutPesewas / revenuePesewas : 0

  return NextResponse.json({
    range,
    dau: days.map((day) => ({ day, count: dauByDay.get(day)?.size ?? 0 })),
    postsPerDay: days.map((day) => ({ day, count: postsByDay.get(day) ?? 0 })),
    paywallHits: days.map((day) => ({ day, count: paywallByDay.get(day) ?? 0 })),
    funnel: { hits, checkoutStarted, paid: paidCount },
    conversion: { userCount, plusCount, primeCount, plusRate, primeRate, paidRate },
    arppuPesewas,
    revenuePesewas,
    paidOutPesewas,
    payoutRatio,
  })
}
