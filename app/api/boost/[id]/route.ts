import { NextRequest, NextResponse } from "next/server"
import { prisma } from "@/lib/prisma"
import { getCurrentUser } from "@/lib/getCurrentUser"
import { getBoostExpiry, isBoostActive } from "@/lib/boost"
import { creditUser, toCreditErrorResponse, trackFeatureEvent } from "@/lib/credits"

export const dynamic = "force-dynamic"

// Boosts are credits-only. Tiers:
// 24h 300cr · 3d 700cr · 7d 1,500cr · all-campus 2,000cr (7d boost + 24h pin)
// · mega 5,000cr (7d boost + 24h pin, top placement). Free boosts cover 24h.
// Voice posts also accept a dedicated 500cr voice boost (24h, top of voice).
// Real money is only for buying credits + subscription — no Paystack here.
const BOOST_TIERS = {
  day: { days: 1, cost: 300, pinHours: 0 },
  three: { days: 3, cost: 700, pinHours: 0 },
  week: { days: 7, cost: 1_500, pinHours: 0 },
  all: { days: 7, cost: 2_000, pinHours: 24 },
  mega: { days: 7, cost: 5_000, pinHours: 24 },
  voice: { days: 1, cost: 500, pinHours: 0 },
} as const

type BoostTierId = keyof typeof BOOST_TIERS

export async function POST(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params
  const user = await getCurrentUser(req)
  if (!user) return NextResponse.json({ error: "not authenticated." }, { status: 401 })

  const body = await req.json().catch(() => ({}))
  const tierId: BoostTierId =
    body.tier === "three" || body.tier === "week" || body.tier === "all" || body.tier === "mega" || body.tier === "voice"
      ? body.tier
      : "day"
  const tier = BOOST_TIERS[tierId]
  const BOOST_CREDIT_COST = tier.cost

  const post = await prisma.post.findUnique({ where: { id } })
  if (!post) return NextResponse.json({ error: "post not found." }, { status: 404 })
  if (post.userId !== user.id) {
    return NextResponse.json({ error: "you can only boost your own posts." }, { status: 403 })
  }
  if (tierId === "voice" && post.type !== "voice") {
    return NextResponse.json({ error: "voice boost is only for voice posts." }, { status: 400 })
  }

  if (isBoostActive(post)) {
    return NextResponse.json({ success: true, alreadyBoosted: true, message: "already boosted." })
  }

  if (user.freeBoosts > 0 && tierId === "day") {
    await prisma.$transaction([
      prisma.user.update({ where: { id: user.id }, data: { freeBoosts: { decrement: 1 } } }),
      prisma.post.update({
        where: { id },
        data: { boosted: true, boostedUntil: getBoostExpiry() },
      }),
    ])
    return NextResponse.json({ success: true, message: "boosted for 24h!" })
  }

  // No free boosts (or a paid tier) -> credits boost.
  const reference = `boost_${user.id}_${id}_${Date.now()}`
  try {
    const result = await creditUser(user.id, "BOOST_PURCHASE", -BOOST_CREDIT_COST, reference, { postId: id, direct: true, tier: tierId, days: tier.days })
    try {
      const fresh = await prisma.post.findUnique({ where: { id }, select: { boostedUntil: true } })
      if (!fresh) throw new Error("post not found")
      if (isBoostActive(fresh)) {
        // Boosted meanwhile — refund, nothing charged.
        await creditUser(user.id, "BOOST_PURCHASE", BOOST_CREDIT_COST, `${reference}_refund`, { postId: id, refund: true }).catch(() => {})
        return NextResponse.json({ success: true, alreadyBoosted: true, message: "already boosted." })
      }
      const boostedUntil = new Date(Date.now() + tier.days * 24 * 60 * 60 * 1000)
      await prisma.post.update({
        where: { id },
        data: {
          boosted: true,
          boostedUntil,
          ...(tier.pinHours > 0 ? { pinnedUntil: new Date(Date.now() + tier.pinHours * 60 * 60 * 1000) } : {}),
        },
      })
    } catch {
      await creditUser(user.id, "BOOST_PURCHASE", BOOST_CREDIT_COST, `${reference}_refund`, { postId: id, refund: true }).catch(() => {})
      return NextResponse.json({ error: "boost failed, credits refunded. try again." }, { status: 500 })
    }
    await trackFeatureEvent({ userId: user.id, type: "boost_buy", metadata: { postId: id, tier: tierId, cost: BOOST_CREDIT_COST } })
    return NextResponse.json({ success: true, creditsUsed: BOOST_CREDIT_COST, tier: tierId, newBalance: result.newBalance, message: tierId === "day" ? "boosted for 24h!" : `boosted (${tierId})!` })
  } catch (err) {
    return toCreditErrorResponse(err, "boost failed.")
  }
}
