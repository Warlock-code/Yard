import { NextRequest, NextResponse } from "next/server"
import { prisma } from "@/lib/prisma"
import { getCurrentUser } from "@/lib/getCurrentUser"
import {
  creditUser,
  toCreditErrorResponse,
  trackFeatureEvent,
  CREDIT_CONFIG,
} from "@/lib/credits"
import { REACTION_EMOJI } from "@/lib/reactions"

export const dynamic = "force-dynamic"

// Custom reactions — 🔥 😂 💀 ❤️ 🐐 + more. 50cr unlocks an emoji forever
// (stored in ownedCosmetics as `reaction:<emoji>`), 10cr per use. Counts are
// public aggregates — no de-anonymization.
// Custom reactions — counts are public aggregates, no de-anonymization.
// Catalog lives in lib/reactions.ts (route files may only export handlers).

function reactionKey(emoji: string) {
  return `reaction:${emoji}`
}

export async function GET(req: NextRequest) {
  const user = await getCurrentUser(req)
  if (!user) return NextResponse.json({ error: "not authenticated." }, { status: 401 })

  const postId = new URL(req.url).searchParams.get("postId")
  const commentId = new URL(req.url).searchParams.get("commentId")
  if (!postId && !commentId) return NextResponse.json({ error: "postId or commentId required." }, { status: 400 })

  try {
    const rows = await prisma.reaction.groupBy({
      by: ["emoji"],
      where: { ...(postId ? { postId } : { commentId }) },
      _count: { _all: true },
    })
    const unlocked = new Set(
      (user.ownedCosmetics || []).filter((c) => c.startsWith("reaction:")).map((c) => c.slice("reaction:".length))
    )
    return NextResponse.json({
      counts: rows.map((r) => ({ emoji: r.emoji, count: r._count._all })),
      unlocked: [...unlocked],
      catalog: REACTION_EMOJI,
      unlockCost: CREDIT_CONFIG.SPEND.REACTION_UNLOCK,
      useCost: CREDIT_CONFIG.SPEND.REACTION_USE,
    })
  } catch {
    return NextResponse.json({ counts: [], unlocked: [], catalog: REACTION_EMOJI })
  }
}

export async function POST(req: NextRequest) {
  const user = await getCurrentUser(req)
  if (!user) return NextResponse.json({ error: "not authenticated." }, { status: 401 })

  const body = await req.json().catch(() => ({}))
  const action = body.action === "unlock" ? "unlock" : "use"

  if (action === "unlock") {
    const emoji = typeof body.emoji === "string" ? body.emoji : ""
    if (!(REACTION_EMOJI as readonly string[]).includes(emoji)) {
      return NextResponse.json({ error: "invalid reaction." }, { status: 400 })
    }
    if ((user.ownedCosmetics || []).includes(reactionKey(emoji))) {
      return NextResponse.json({ success: true, alreadyOwned: true })
    }
    try {
      const r = await creditUser(user.id, "REACTION_UNLOCK", -CREDIT_CONFIG.SPEND.REACTION_UNLOCK, `react_${user.id}_${Date.now()}`, { emoji })
      try {
        await prisma.user.update({
          where: { id: user.id },
          data: { ownedCosmetics: { push: reactionKey(emoji) } },
        })
      } catch {
        await creditUser(user.id, "REACTION_UNLOCK", CREDIT_CONFIG.SPEND.REACTION_UNLOCK, `react_${user.id}_${Date.now()}_refund`, { refund: true }).catch(() => {})
        return NextResponse.json({ error: "unlock failed, credits refunded." }, { status: 500 })
      }
      await trackFeatureEvent({ userId: user.id, type: "reaction_unlock", metadata: { emoji } })
      return NextResponse.json({ success: true, newBalance: r.newBalance })
    } catch (err) {
      return toCreditErrorResponse(err, "unlocking costs 50cr.")
    }
  }

  const emoji = typeof body.emoji === "string" ? body.emoji : ""
  const postId = typeof body.postId === "string" ? body.postId : null
  const commentId = typeof body.commentId === "string" ? body.commentId : null
  if (!emoji || (!postId && !commentId) || (postId && commentId)) {
    return NextResponse.json({ error: "emoji + exactly one of postId/commentId required." }, { status: 400 })
  }
  if (!(user.ownedCosmetics || []).includes(reactionKey(emoji))) {
    return NextResponse.json({ error: "unlock this reaction first (50cr).", needsUnlock: true }, { status: 400 })
  }

  try {
    const r = await creditUser(user.id, "REACTION_USE", -CREDIT_CONFIG.SPEND.REACTION_USE, `reactuse_${user.id}_${Date.now()}`, {
      emoji,
      postId,
      commentId,
    })
    try {
      await prisma.reaction.create({ data: { postId, commentId, userId: user.id, emoji } })
    } catch {
      await creditUser(user.id, "REACTION_USE", CREDIT_CONFIG.SPEND.REACTION_USE, `reactuse_${user.id}_${Date.now()}_refund`, { refund: true }).catch(() => {})
      return NextResponse.json({ error: "reaction failed, credits refunded." }, { status: 500 })
    }
    await trackFeatureEvent({ userId: user.id, type: "reaction_use", metadata: { emoji } })
    return NextResponse.json({ success: true, newBalance: r.newBalance })
  } catch (err) {
    return toCreditErrorResponse(err, "reactions cost 10cr each.")
  }
}
