import { NextRequest, NextResponse } from "next/server"
import { prisma } from "@/lib/prisma"
import { getCurrentUser } from "@/lib/getCurrentUser"
import { creditUser, toCreditErrorResponse, trackFeatureEvent, CREDIT_CONFIG } from "@/lib/credits"
import { auditLog } from "@/lib/auditLog"

export const dynamic = "force-dynamic"

// Referral boost — pay 200cr and your NEXT completed referral pays 2x
// (1,400cr to you, 600cr to them; reuses EARN.REFERRAL_* at completion).
// Unused boosts stack. Applied by lib/referral-rewards at completion time
// (signup is the primary path now; verify-email remains a legacy fallback).
// Milestones (applied there too): 5 verified refs → free PLUS 30d,
// 10 verified → free PRIME 30d (tier + tierExpiresAt). Abuse guards:
// Referral.referredId is UNIQUE (one reward per referredId, enforced by the
// DB), self-referral is rejected (referrer.id !== userId), velocity ≥20/wk
// is flagged, and every boost purchase logs IP/device via AuditLog so
// same-device farms can be cross-checked in admin review.
const PLUS_AT = 5
const PRIME_AT = 10

export async function POST(req: NextRequest) {
  const user = await getCurrentUser(req)
  if (!user) return NextResponse.json({ error: "not authenticated." }, { status: 401 })

  try {
    const r = await creditUser(user.id, "REFERRAL_BOOST", -CREDIT_CONFIG.SPEND.REFERRAL_BOOST, `refboost_${user.id}_${Date.now()}`, {})
    await trackFeatureEvent({ userId: user.id, type: "referral_boost", metadata: {} })
    // Abuse cross-check trail: IP + device fingerprint for farm review.
    const ip = req.headers.get("x-forwarded-for")?.split(",")[0]?.trim() || req.headers.get("x-real-ip") || "unknown"
    const userAgent = req.headers.get("user-agent") || "unknown"
    await auditLog("user.referral", user.id, user.id, {
      success: true,
      kind: "boost_purchase",
      ipAddress: ip,
      userAgent,
    })
    const progress = await milestoneProgress(user.id).catch(() => null)
    return NextResponse.json({
      success: true,
      newBalance: r.newBalance,
      message: "boost armed — your next invite pays 2x.",
      ...(progress ? { progress } : {}),
    })
  } catch (err) {
    return toCreditErrorResponse(err, "the referral boost costs 200cr.")
  }
}

async function milestoneProgress(userId: string) {
  const [boosts, used, verified] = await Promise.all([
    prisma.creditTransaction.count({ where: { userId, type: "REFERRAL_BOOST" } }),
    prisma.creditTransaction.count({
      where: { userId, type: "REFERRAL", metadata: { path: ["boosted"], equals: true } },
    }),
    prisma.referral.count({ where: { referrerId: userId, rewardStatus: "completed" } }),
  ])
  const armedBoosts = Math.max(0, boosts - used)
  const next = verified >= PRIME_AT ? null : verified >= PLUS_AT ? { tier: "PRIME", at: PRIME_AT, remaining: PRIME_AT - verified } : { tier: "PLUS", at: PLUS_AT, remaining: PLUS_AT - verified }
  return { armedBoosts, verified, plusAt: PLUS_AT, primeAt: PRIME_AT, next }
}

export async function GET(req: NextRequest) {
  const user = await getCurrentUser(req)
  if (!user) return NextResponse.json({ error: "not authenticated." }, { status: 401 })

  try {
    const progress = await milestoneProgress(user.id)
    return NextResponse.json({
      ...progress,
      cost: CREDIT_CONFIG.SPEND.REFERRAL_BOOST,
      referrerReward: CREDIT_CONFIG.EARN.REFERRAL_REFERRER,
      refereeReward: CREDIT_CONFIG.EARN.REFERRAL_REFEREE,
    })
  } catch {
    return NextResponse.json({ armedBoosts: 0, verified: 0 })
  }
}
