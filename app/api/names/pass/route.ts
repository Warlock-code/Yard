import { NextRequest, NextResponse } from "next/server"
import { prisma } from "@/lib/prisma"
import { getCurrentUser } from "@/lib/getCurrentUser"
import { creditUser, toCreditErrorResponse, trackFeatureEvent, CREDIT_CONFIG } from "@/lib/credits"

export const dynamic = "force-dynamic"

const PASS_MS = 7 * 24 * 60 * 60 * 1000

function passFlag(expiryMs: number) {
  return `namepass-7d:${expiryMs}`
}

function validFlagUntil(owned: string[]): number | null {
  let best: number | null = null
  for (const c of owned || []) {
    if (!c.startsWith("namepass-7d:")) continue
    const ms = Number(c.slice("namepass-7d:".length))
    if (Number.isSafeInteger(ms) && ms > Date.now() && (best === null || ms > best)) best = ms
  }
  return best
}

// Unlimited name reveals for 7 days — 1,000cr (NAME_REVEAL_WEEK).
// The pass lives in two places so reveals stay live-safe: a NAME_PASS credit
// transaction (source of truth) + a `namepass-7d:{expiry}` flag in
// User.ownedCosmetics (fast check). /api/names/reveal honors either.
export async function POST(req: NextRequest) {
  const user = await getCurrentUser(req)
  if (!user) return NextResponse.json({ error: "not authenticated." }, { status: 401 })

  try {
    const recent = await prisma.creditTransaction.findFirst({
      where: {
        userId: user.id,
        type: "NAME_PASS",
        createdAt: { gte: new Date(Date.now() - PASS_MS) },
      },
      orderBy: { createdAt: "desc" },
      select: { createdAt: true },
    }).catch(() => null)
    const flagUntil = validFlagUntil(user.ownedCosmetics || [])
    const existingUntil = recent ? recent.createdAt.getTime() + PASS_MS : flagUntil
    if (existingUntil && existingUntil > Date.now()) {
      return NextResponse.json({ success: true, alreadyOwned: true, unlimitedUntil: new Date(existingUntil) })
    }
  } catch {
    // fall through to purchase
  }

  try {
    const r = await creditUser(user.id, "NAME_PASS", -CREDIT_CONFIG.SPEND.NAME_REVEAL_WEEK, `namepass_${user.id}_${Date.now()}`, {})
    const until = Date.now() + PASS_MS
    try {
      await prisma.user.update({
        where: { id: user.id },
        data: { ownedCosmetics: { push: passFlag(until) } },
      })
    } catch {
      // flag is a speedup — the NAME_PASS txn above is the source of truth
    }
    await trackFeatureEvent({ userId: user.id, type: "name_pass", metadata: {} })
    return NextResponse.json({
      success: true,
      newBalance: r.newBalance,
      unlimitedUntil: new Date(until),
    })
  } catch (err) {
    return toCreditErrorResponse(err, "the 7-day pass costs 1,000cr.")
  }
}
