import { NextRequest, NextResponse } from "next/server"
import { prisma } from "@/lib/prisma"
import { getCurrentUser } from "@/lib/getCurrentUser"
import {
  creditUser,
  toCreditErrorResponse,
  trackFeatureEvent,
  CREDIT_CONFIG,
} from "@/lib/credits"

export const dynamic = "force-dynamic"

// Campus war funding — campus pride as a sink. 100cr = 100 pts,
// 1,000cr = 1,200 pts, 5,000cr = 7,000 pts (bulk bonus). Points are summed
// from CAMPUS_WAR transactions per week — no new tables. Winning campus gets
// a badge + free boosts for top contributors at week close (leaderboard cron).
const TIERS = {
  small: { cost: 100, points: 100 },
  med: { cost: 1_000, points: 1_200 },
  large: { cost: 5_000, points: 7_000 },
} as const

function weekStartUTC(now = new Date()) {
  const day = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate()))
  const shift = (day.getUTCDay() + 6) % 7
  return new Date(day.getTime() - shift * 86_400_000)
}

export async function GET(req: NextRequest) {
  const user = await getCurrentUser(req)
  if (!user) return NextResponse.json({ error: "not authenticated." }, { status: 401 })

  const start = weekStartUTC()
  let totals: { campus: string; points: number; contributions: number }[] = []
  let myPoints = 0
  try {
    const rows = await prisma.creditTransaction.findMany({
      where: { type: "CAMPUS_WAR", createdAt: { gte: start } },
      select: { amount: true, userId: true, metadata: true },
      take: 20000,
    })
    const byCampus = new Map<string, { points: number; contributions: number }>()
    for (const r of rows) {
      const m = r.metadata as { campus?: unknown; points?: unknown } | null
      const campus = typeof m?.campus === "string" ? m.campus : null
      const points = typeof m?.points === "number" ? m.points : 0
      if (!campus) continue
      const slot = byCampus.get(campus) ?? { points: 0, contributions: 0 }
      slot.points += points
      slot.contributions += 1
      byCampus.set(campus, slot)
      if (r.userId === user.id) myPoints += points
    }
    totals = [...byCampus.entries()]
      .map(([campus, v]) => ({ campus, ...v }))
      .sort((a, b) => b.points - a.points)
  } catch {
    totals = []
  }

  return NextResponse.json({
    weekStart: start,
    myCampus: user.campus,
    myPoints,
    totals,
    tiers: TIERS,
  })
}

export async function POST(req: NextRequest) {
  const user = await getCurrentUser(req)
  if (!user) return NextResponse.json({ error: "not authenticated." }, { status: 401 })

  const body = await req.json().catch(() => ({}))
  const tierId: keyof typeof TIERS = body.tier === "med" || body.tier === "large" ? body.tier : "small"
  const tier = TIERS[tierId]

  const cost =
    tierId === "med"
      ? CREDIT_CONFIG.SPEND.CAMPUS_WAR_MED
      : tierId === "large"
        ? CREDIT_CONFIG.SPEND.CAMPUS_WAR_LARGE
        : CREDIT_CONFIG.SPEND.CAMPUS_WAR_SMALL
  const points = tier.points
  const reference = `war_${user.id}_${Date.now()}`

  try {
    const r = await creditUser(user.id, "CAMPUS_WAR", -cost, reference, {
      campus: user.campus,
      points,
      tier: tierId,
    })
    await trackFeatureEvent({ userId: user.id, type: "war_fund", metadata: { cost, points, campus: user.campus } })
    return NextResponse.json({ success: true, cost, points, campus: user.campus, newBalance: r.newBalance })
  } catch (err) {
    return toCreditErrorResponse(err, "couldn't fund the war.")
  }
}
