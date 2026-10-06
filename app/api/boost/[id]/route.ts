import { NextRequest, NextResponse } from "next/server"
import { prisma } from "@/lib/prisma"
import { getCurrentUser } from "@/lib/getCurrentUser"
import { getBoostExpiry, isBoostActive } from "@/lib/boost"
import { creditUser, CREDIT_CONFIG } from "@/lib/credits"

export const dynamic = "force-dynamic"

// Boosts are credits-only: burn a free boost if you have one,
// otherwise 300 credits for 24h. Real money is only for buying
// credits + subscription — no Paystack checkout here.
const BOOST_CREDIT_COST = CREDIT_CONFIG.SPEND.BOOST_24H

export async function POST(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params
  const user = await getCurrentUser(req)
  if (!user) return NextResponse.json({ error: "not authenticated." }, { status: 401 })

  const post = await prisma.post.findUnique({ where: { id } })
  if (!post) return NextResponse.json({ error: "post not found." }, { status: 404 })
  if (post.userId !== user.id) {
    return NextResponse.json({ error: "you can only boost your own posts." }, { status: 403 })
  }

  if (isBoostActive(post)) {
    return NextResponse.json({ success: true, alreadyBoosted: true, message: "already boosted." })
  }

  if (user.freeBoosts > 0) {
    await prisma.$transaction([
      prisma.user.update({ where: { id: user.id }, data: { freeBoosts: { decrement: 1 } } }),
      prisma.post.update({
        where: { id },
        data: { boosted: true, boostedUntil: getBoostExpiry() },
      }),
    ])
    return NextResponse.json({ success: true, message: "boosted for 24h!" })
  }

  // No free boosts left -> direct credits boost for 24h.
  const reference = `boost_${user.id}_${id}_${Date.now()}`
  try {
    const result = await creditUser(user.id, "BOOST_PURCHASE", -BOOST_CREDIT_COST, reference, { postId: id, direct: true })
    try {
      const fresh = await prisma.post.findUnique({ where: { id }, select: { boostedUntil: true } })
      if (!fresh) throw new Error("post not found")
      if (isBoostActive(fresh)) {
        // Boosted meanwhile — refund, nothing charged.
        await creditUser(user.id, "BOOST_PURCHASE", BOOST_CREDIT_COST, `${reference}_refund`, { postId: id, refund: true }).catch(() => {})
        return NextResponse.json({ success: true, alreadyBoosted: true, message: "already boosted." })
      }
      await prisma.post.update({
        where: { id },
        data: { boosted: true, boostedUntil: getBoostExpiry() },
      })
    } catch {
      await creditUser(user.id, "BOOST_PURCHASE", BOOST_CREDIT_COST, `${reference}_refund`, { postId: id, refund: true }).catch(() => {})
      return NextResponse.json({ error: "boost failed, credits refunded. try again." }, { status: 500 })
    }
    return NextResponse.json({ success: true, creditsUsed: BOOST_CREDIT_COST, newBalance: result.newBalance, message: "boosted for 24h!" })
  } catch (err) {
    return NextResponse.json({ error: err instanceof Error ? err.message : "Insufficient credits" }, { status: 400 })
  }
}
