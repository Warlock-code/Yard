import { NextRequest, NextResponse } from "next/server"
import { prisma } from "@/lib/prisma"
import { getCurrentUser } from "@/lib/getCurrentUser"
import { initializeSubscription } from "@/lib/paystack"
import { reportServerError } from "@/lib/errorAlerts"

const PLANS: Record<string, string | undefined> = {
  plus: process.env.PAYSTACK_PLUS_PLAN_CODE,
  prime: process.env.PAYSTACK_PRIME_PLAN_CODE,
  plus_annual: process.env.PAYSTACK_PLUS_ANNUAL_PLAN_CODE,
  prime_annual: process.env.PAYSTACK_PRIME_ANNUAL_PLAN_CODE,
}

const PLAN_PRICE_PESEWAS: Record<string, number> = {
  plus: Number(process.env.PAYSTACK_PLUS_PRICE_PESEWAS || 1000), // GHS 10/mo
  prime: Number(process.env.PAYSTACK_PRIME_PRICE_PESEWAS || 2000), // GHS 20/mo
  plus_annual: Number(process.env.PAYSTACK_PLUS_ANNUAL_PRICE_PESEWAS || 10000), // GHS 100/yr
  prime_annual: Number(process.env.PAYSTACK_PRIME_ANNUAL_PRICE_PESEWAS || 20000), // GHS 200/yr
}

const ANNUAL_KINDS = new Set(["plus_annual", "prime_annual"])

export async function POST(req: NextRequest, { params }: { params: Promise<{ tier: string }> }) {
  const { tier: tierParam } = await params
  const user = await getCurrentUser(req)
  if (!user) return NextResponse.json({ error: "not authenticated." }, { status: 401 })

  const tier = tierParam.toLowerCase()
  const planCode = PLANS[tier]
  if (!planCode) {
    if (ANNUAL_KINDS.has(tier)) {
      // Graceful (non-500): annual plans need env plan codes on the server.
      return NextResponse.json({ error: "annual plans aren't configured yet — check back soon." }, { status: 503 })
    }
    return NextResponse.json({ error: "invalid tier. Only 'plus' and 'prime' are available." }, { status: 400 })
  }

  // Server guard — frontend also blocks but we enforce here. Effective tier
  // honors expiry (an expired PLUS row reads as FREE and may resubscribe).
  const { getEffectiveTier } = await import("@/lib/tier")
  const effectiveTier = getEffectiveTier(user)
  const baseTier = tier.replace("_annual", "")
  if (baseTier === "plus" && (effectiveTier === "PLUS" || effectiveTier === "PRIME")) return NextResponse.json({ error: "already on Plus or higher." }, { status: 400 })
  if (baseTier === "prime" && effectiveTier === "PRIME") return NextResponse.json({ error: "already on Prime." }, { status: 400 })

  const reference = `sub_${tier}_${user.id}_${Date.now()}`
  let amount = PLAN_PRICE_PESEWAS[tier]
  if (!Number.isSafeInteger(amount) || amount <= 0) return NextResponse.json({ error: "plan price not configured." }, { status: 500 })

  // Win-back promo: unused 50%-off PLUS promo halves one purchase.
  let promoApplied = false
  if (baseTier === "plus" && !ANNUAL_KINDS.has(tier)) {
    try {
      const [promos, used] = await Promise.all([
        prisma.analyticsEvent.count({ where: { userId: user.id, type: "winback_promo" } }),
        prisma.analyticsEvent.count({ where: { userId: user.id, type: "winback_promo_used" } }),
      ])
      if (promos > used) {
        amount = Math.round(amount / 2)
        promoApplied = true
      }
    } catch {
      promoApplied = false
    }
  }

  await prisma.transaction.create({
    data: {
      userId: user.id,
      kind: tier,
      reference,
      amount,
      metadata: { tier, ...(promoApplied ? { promo: "winback_50" } : {}) },
    },
  })

  try {
    const payment = await initializeSubscription(user.email, planCode, reference, amount)
    return NextResponse.json(payment)
  } catch (payErr) {
    await reportServerError({ route: "/api/subscribe/[tier]", error: payErr, metadata: { tier } })
    // Clean up pending transaction so user can retry immediately
    await prisma.transaction.updateMany({
      where: { reference, status: "pending" },
      data: { status: "failed", metadata: { tier, initError: payErr instanceof Error ? payErr.message : String(payErr) } },
    })
    return NextResponse.json({ error: payErr instanceof Error ? payErr.message : "Payment init failed." }, { status: 500 })
  }
}