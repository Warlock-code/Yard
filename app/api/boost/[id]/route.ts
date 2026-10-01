import { NextRequest, NextResponse } from "next/server"
import { prisma } from "@/lib/prisma"
import { getCurrentUser } from "@/lib/getCurrentUser"
import { getBoostExpiry, isBoostActive } from "@/lib/boost"
import { initializePaystack } from "@/lib/paystack"
import { reportServerError } from "@/lib/errorAlerts"

export const dynamic = "force-dynamic"

export const BOOST_PRICE_PESEWAS = 300 // GHS 3.00 for 24h

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
    return NextResponse.json({ success: true })
  }

  // No free boosts left -> paid contextual boost: GHS 3 for 24h via Paystack.
  // Reuses the same Transaction -> webhook -> fulfillPaidTransaction("boost") path.
  const reference = `boost_${user.id}_${id}_${Date.now()}`

  await prisma.transaction.create({
    data: {
      userId: user.id,
      kind: "boost",
      reference,
      amount: BOOST_PRICE_PESEWAS,
      metadata: { postId: id },
    },
  })

  try {
    const payment = await initializePaystack(user.email, BOOST_PRICE_PESEWAS, reference)
    return NextResponse.json(payment)
  } catch (err) {
    await reportServerError({ route: "/api/boost/[id]", error: err, metadata: { postId: id } })
    await prisma.transaction.updateMany({ where: { reference, status: "pending" }, data: { status: "failed" } }).catch(() => {})
    return NextResponse.json({ error: err instanceof Error ? err.message : "Checkout failed" }, { status: 400 })
  }
}