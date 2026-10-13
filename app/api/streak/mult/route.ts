import { NextRequest, NextResponse } from "next/server"
import { prisma } from "@/lib/prisma"
import { getCurrentUser } from "@/lib/getCurrentUser"
import {
  creditUser,
  toCreditErrorResponse,
  trackFeatureEvent,
  activeStreakMult,
  CREDIT_CONFIG,
} from "@/lib/credits"

export const dynamic = "force-dynamic"

// Streak multiplier — 2x for 7 days (500cr), 3x for 7 days (1,200cr).
// Stacks with rush hour: earn paths multiply base × tier × streakMult × rush,
// and the purchase carries `stacksWithRush: true` + `expiresAt` metadata so
// any reader (posts milestones, battle wins) can honor it.
const WINDOW_MS = 7 * 24 * 60 * 60 * 1000

async function activeWindow(userId: string): Promise<{ mult: 1 | 2 | 3; expiresAt: Date | null }> {
  const mult = await activeStreakMult(userId).catch(() => 1 as const)
  if (mult === 1) return { mult, expiresAt: null }
  try {
    const latest = await prisma.creditTransaction.findFirst({
      where: { userId, type: "STREAK_MULT", createdAt: { gte: new Date(Date.now() - WINDOW_MS) } },
      orderBy: { createdAt: "desc" },
      select: { createdAt: true },
    })
    return {
      mult,
      expiresAt: latest ? new Date(latest.createdAt.getTime() + WINDOW_MS) : null,
    }
  } catch {
    return { mult, expiresAt: null }
  }
}

export async function GET(req: NextRequest) {
  const user = await getCurrentUser(req)
  if (!user) return NextResponse.json({ error: "not authenticated." }, { status: 401 })
  const { mult, expiresAt } = await activeWindow(user.id)
  return NextResponse.json({
    active: mult,
    expiresAt,
    stacksWithRush: true,
    x2: CREDIT_CONFIG.SPEND.STREAK_MULT_2X,
    x3: CREDIT_CONFIG.SPEND.STREAK_MULT_3X,
  })
}

export async function POST(req: NextRequest) {
  const user = await getCurrentUser(req)
  if (!user) return NextResponse.json({ error: "not authenticated." }, { status: 401 })

  const body = await req.json().catch(() => ({}))
  const mult = body.mult === 3 ? 3 : 2
  const cost = mult === 3 ? CREDIT_CONFIG.SPEND.STREAK_MULT_3X : CREDIT_CONFIG.SPEND.STREAK_MULT_2X
  const expiresAt = new Date(Date.now() + WINDOW_MS)

  try {
    const r = await creditUser(user.id, "STREAK_MULT", -cost, `smult_${user.id}_${Date.now()}`, {
      mult,
      expiresAt: expiresAt.toISOString(),
      stacksWithRush: true,
    })
    await trackFeatureEvent({ userId: user.id, type: "streak_mult", metadata: { mult, cost, stacksWithRush: true } })
    return NextResponse.json({ success: true, mult, expiresAt, stacksWithRush: true, newBalance: r.newBalance })
  } catch (err) {
    return toCreditErrorResponse(err, "the multiplier costs credits.")
  }
}
