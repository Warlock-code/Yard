import { NextRequest, NextResponse } from "next/server"
import { prisma } from "@/lib/prisma"
import { getCurrentUser } from "@/lib/getCurrentUser"
import { creditUser, CREDIT_CONFIG } from "@/lib/credits"

export const dynamic = "force-dynamic"

// Tip a post author with credits. Additive + live-safe: brand-new route,
// no changes to existing flows. Limits come from CREDIT_CONFIG so the
// admin can tune them without code changes.
export async function POST(req: NextRequest) {
  const user = await getCurrentUser(req)
  if (!user) return NextResponse.json({ error: "not authenticated." }, { status: 401 })

  const body = await req.json().catch(() => ({}))
  const postId = typeof body.postId === "string" ? body.postId : ""
  const amount = typeof body.amount === "number" ? Math.floor(body.amount) : 0

  if (!postId) return NextResponse.json({ error: "post is required." }, { status: 400 })
  if (!Number.isSafeInteger(amount) || amount < CREDIT_CONFIG.SPEND.TIP_MIN) {
    return NextResponse.json({ error: `minimum tip is ${CREDIT_CONFIG.SPEND.TIP_MIN} credits.` }, { status: 400 })
  }
  if (amount > CREDIT_CONFIG.SPEND.TIP_MAX_PER_USER_DAILY) {
    return NextResponse.json({ error: `max ${CREDIT_CONFIG.SPEND.TIP_MAX_PER_USER_DAILY} credits per person per day.` }, { status: 400 })
  }

  const post = await prisma.post.findUnique({
    where: { id: postId },
    select: { id: true, userId: true },
  })
  if (!post) return NextResponse.json({ error: "post not found." }, { status: 404 })
  if (post.userId === user.id) return NextResponse.json({ error: "you can't tip yourself." }, { status: 400 })

  const author = await prisma.user.findUnique({
    where: { id: post.userId },
    select: { id: true, tier: true, status: true },
  })
  if (!author || author.status !== "ACTIVE") {
    return NextResponse.json({ error: "author is unavailable." }, { status: 400 })
  }

  // Receiving is an earning: gated by tier like votes/battles (FREE earns 0).
  const multiplier =
    CREDIT_CONFIG.TIER_MULTIPLIER[author.tier as keyof typeof CREDIT_CONFIG.TIER_MULTIPLIER]?.tipReceived ?? 0
  if (multiplier <= 0) {
    return NextResponse.json({ error: "author needs plus to receive tips." }, { status: 400 })
  }

  // Daily caps (sender side).
  const dayStart = new Date()
  dayStart.setHours(0, 0, 0, 0)
  const sentToday = await prisma.creditTransaction.findMany({
    where: { userId: user.id, type: "TIP_SENT", createdAt: { gte: dayStart } },
    select: { amount: true, metadata: true },
  })
  let totalSent = 0
  let sentToAuthor = 0
  for (const t of sentToday) {
    totalSent += Math.abs(t.amount)
    const meta = t.metadata as { authorId?: unknown } | null
    if (meta && typeof meta === "object" && meta.authorId === author.id) {
      sentToAuthor += Math.abs(t.amount)
    }
  }
  if (totalSent + amount > CREDIT_CONFIG.SPEND.TIP_MAX_DAILY) {
    return NextResponse.json({ error: `daily tipping limit is ${CREDIT_CONFIG.SPEND.TIP_MAX_DAILY} credits.` }, { status: 400 })
  }
  if (sentToAuthor + amount > CREDIT_CONFIG.SPEND.TIP_MAX_PER_USER_DAILY) {
    return NextResponse.json({ error: `you've reached today's limit for this person.` }, { status: 400 })
  }

  const fee = Math.ceil((amount * CREDIT_CONFIG.FEE.TIP_PCT) / 100)
  const received = Math.round((amount - fee) * multiplier)
  if (received <= 0) {
    return NextResponse.json({ error: "tip too small after fees." }, { status: 400 })
  }

  const reference = `tip_${user.id}_${postId}_${Date.now()}`
  try {
    const debit = await creditUser(user.id, "TIP_SENT", -amount, reference, {
      postId,
      authorId: author.id,
      fee,
      net: received,
    })
    try {
      await creditUser(author.id, "TIP_RECEIVED", received, `${reference}_to`, {
        postId,
        fromUserId: user.id,
        fee,
        gross: amount,
      })
    } catch {
      // Author credit failed after sender debit — refund so nobody pays for nothing.
      await creditUser(user.id, "TIP_SENT", amount, `${reference}_refund`, {
        postId,
        authorId: author.id,
        refund: true,
      }).catch(() => {})
      return NextResponse.json({ error: "tip failed, credits refunded. try again." }, { status: 500 })
    }

    // Notify the author — best effort, never breaks the tip.
    try {
      await prisma.notification.create({
        data: {
          userId: author.id,
          type: "tip",
          title: "you got a tip 🎉",
          body: `${user.ghostId} tipped you ${received} credits.`,
          href: `/post/${postId}`,
          actorName: user.ghostId,
        },
      })
    } catch {}

    return NextResponse.json({
      success: true,
      sent: amount,
      fee,
      received,
      newBalance: debit.newBalance,
      message: `tipped ${received} credits!`,
    })
  } catch (err) {
    return NextResponse.json({ error: err instanceof Error ? err.message : "insufficient credits." }, { status: 400 })
  }
}
