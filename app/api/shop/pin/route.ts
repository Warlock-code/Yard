import { NextRequest, NextResponse } from "next/server"
import { prisma } from "@/lib/prisma"
import { getCurrentUser } from "@/lib/getCurrentUser"
import { creditUser, CREDIT_CONFIG } from "@/lib/credits"

export const dynamic = "force-dynamic"

const PIN_COST = CREDIT_CONFIG.SPEND.PIN_1H // 1000 credits
const PIN_MS = 60 * 60 * 1000
const MAX_ACTIVE_PINS_PER_CAMPUS = 3

// Credits-only campus pin: own post pinned to top of campus feed for 1hr.
// Visible power — priced high so the slot stays scarce.
export async function POST(req: NextRequest) {
  const user = await getCurrentUser(req)
  if (!user) return NextResponse.json({ error: "not authenticated." }, { status: 401 })

  const body = await req.json().catch(() => ({}))
  const postId = typeof body.postId === "string" ? body.postId : ""
  if (!postId) return NextResponse.json({ error: "post is required." }, { status: 400 })

  const post = await prisma.post.findUnique({
    where: { id: postId },
    select: { id: true, userId: true, campus: true, archived: true },
  })
  if (!post || post.userId !== user.id) return NextResponse.json({ error: "only your own post can be pinned." }, { status: 403 })
  if (post.archived) return NextResponse.json({ error: "archived posts can't be pinned." }, { status: 400 })

  const now = new Date()
  let activePins = 0
  try {
    activePins = await prisma.post.count({
      where: { campus: post.campus, archived: false, pinnedUntil: { gt: now } },
    })
  } catch {
    return NextResponse.json({ error: "pins are updating — try again in a bit." }, { status: 503 })
  }
  if (activePins >= MAX_ACTIVE_PINS_PER_CAMPUS) {
    return NextResponse.json({ error: "pin slots are full on your campus — try again later." }, { status: 400 })
  }

  const reference = `pin_${user.id}_${postId}_${Date.now()}`
  try {
    const debit = await creditUser(user.id, "PIN_PURCHASE", -PIN_COST, reference, { postId })
    try {
      const pinned = await prisma.post.update({
        where: { id: postId },
        data: { pinnedUntil: new Date(Date.now() + PIN_MS) },
        select: { pinnedUntil: true },
      })
      return NextResponse.json({ success: true, pinnedUntil: pinned.pinnedUntil, newBalance: debit.newBalance })
    } catch {
      await creditUser(user.id, "PIN_PURCHASE", PIN_COST, `${reference}_refund`, { refund: true }).catch(() => {})
      return NextResponse.json({ error: "pin failed, credits refunded. try again." }, { status: 500 })
    }
  } catch (err) {
    return NextResponse.json({ error: err instanceof Error ? err.message : "insufficient credits." }, { status: 400 })
  }
}
