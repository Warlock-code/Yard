import { NextRequest, NextResponse } from "next/server"
import { prisma } from "@/lib/prisma"
import { getCurrentUser } from "@/lib/getCurrentUser"
import { creditUser, toCreditErrorResponse, trackFeatureEvent, CREDIT_CONFIG } from "@/lib/credits"

export const dynamic = "force-dynamic"

// Anonymous reply boost — 100cr pins your reply to top placement within its
// thread (+50 heat, flagged boosted). Public only, never a DM.
export async function POST(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params
  const user = await getCurrentUser(req)
  if (!user) return NextResponse.json({ error: "not authenticated." }, { status: 401 })

  const comment = await prisma.comment.findUnique({
    where: { id },
    select: { id: true, userId: true, postId: true, yeahs: true },
  })
  if (!comment) return NextResponse.json({ error: "comment not found." }, { status: 404 })
  if (comment.userId !== user.id) {
    return NextResponse.json({ error: "you can only boost your own replies." }, { status: 403 })
  }

  const reference = `replyboost_${user.id}_${id}_${Date.now()}`
  try {
    const r = await creditUser(user.id, "REPLY_BOOST", -CREDIT_CONFIG.SPEND.REPLY_BOOST, reference, {
      commentId: id,
      postId: comment.postId,
    })
    try {
      await prisma.comment.update({
        where: { id },
        data: { yeahs: { increment: 50 } },
      })
    } catch {
      await creditUser(user.id, "REPLY_BOOST", CREDIT_CONFIG.SPEND.REPLY_BOOST, `${reference}_refund`, {
        refund: true,
      }).catch(() => {})
      return NextResponse.json({ error: "boost failed, credits refunded. try again." }, { status: 500 })
    }
    await trackFeatureEvent({ userId: user.id, type: "reply_boost", metadata: { commentId: id, postId: comment.postId } }).catch(() => {})
    return NextResponse.json({ success: true, newBalance: r.newBalance })
  } catch (err) {
    return toCreditErrorResponse(err, "reply boosts cost 100cr.")
  }
}
