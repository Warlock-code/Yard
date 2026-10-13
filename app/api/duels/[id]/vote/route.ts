// Duel-specific voting — POST /api/duels/[id]/vote { entryId }.
// Thin wrapper around the battle-vote economy for duel prompts (BattlePrompt
// rows with a `⚔ duel:` prefix): one vote per user per DUEL (not just per
// entry), spectators vote free, entry author earns 1cr × tier with FREE
// shadow. The generic /api/battles/vote route is untouched.
import { NextRequest, NextResponse } from "next/server"
import { prisma } from "@/lib/prisma"
import { getCurrentUser } from "@/lib/getCurrentUser"
import { creditUser, CREDIT_CONFIG } from "@/lib/credits"
import { getEffectiveTier } from "@/lib/tier"

export const dynamic = "force-dynamic"

export async function POST(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params
  const user = await getCurrentUser(req)
  if (!user) return NextResponse.json({ error: "not authenticated." }, { status: 401 })

  const body = await req.json().catch(() => ({}))
  const entryId = typeof body.entryId === "string" ? body.entryId : ""
  if (!entryId) return NextResponse.json({ error: "entry required." }, { status: 400 })

  const prompt = await prisma.battlePrompt.findUnique({
    where: { id },
    select: { id: true, campus: true, active: true, startsAt: true, endsAt: true, text: true },
  })
  if (!prompt || !prompt.text.startsWith("⚔ duel:")) {
    return NextResponse.json({ error: "duel not found." }, { status: 404 })
  }

  const now = new Date()
  if (
    prompt.campus !== user.campus ||
    !prompt.active ||
    prompt.startsAt > now ||
    prompt.endsAt <= now
  ) {
    return NextResponse.json({ error: "this duel isn't open for votes." }, { status: 400 })
  }

  const entry = await prisma.battleEntry.findUnique({
    where: { id: entryId },
    select: { id: true, promptId: true, userId: true, campus: true },
  })
  if (!entry || entry.promptId !== id || entry.userId === user.id || entry.campus !== user.campus) {
    return NextResponse.json({ error: "you cannot vote on this duel entry." }, { status: 400 })
  }

  // One vote per user per duel — a second vote on either take is rejected.
  const prior = await prisma.vote.findFirst({
    where: { userId: user.id, entry: { promptId: id } },
    select: { id: true },
  })
  if (prior) {
    return NextResponse.json({ error: "you already voted in this duel." }, { status: 400 })
  }

  let updatedVotes = 0
  try {
    await prisma.$transaction(async (tx) => {
      await tx.vote.create({ data: { entryId, userId: user.id } })
      const updated = await tx.battleEntry.update({
        where: { id: entryId },
        data: { votes: { increment: 1 } },
      })
      updatedVotes = updated.votes
    })
  } catch (err: unknown) {
    if (typeof err === "object" && err !== null && "code" in err && err.code === "P2002") {
      return NextResponse.json({ error: "you already voted in this duel." }, { status: 400 })
    }
    throw err
  }

  // Same earn rules as battle votes: 1cr × tier to the author, FREE shadow.
  try {
    const owner = await prisma.user.findUnique({
      where: { id: entry.userId },
      select: { tier: true, tierExpiresAt: true },
    })
    if (owner) {
      const tier = getEffectiveTier(owner)
      const multiplier =
        CREDIT_CONFIG.TIER_MULTIPLIER[tier as keyof typeof CREDIT_CONFIG.TIER_MULTIPLIER]?.earn ?? 0
      if (multiplier > 0) {
        const reward = Math.round(CREDIT_CONFIG.EARN.POST_VOTE * multiplier)
        await creditUser(entry.userId, "VOTE_REWARD", reward, `duel_${entryId}`, {
          entryId,
          voterId: user.id,
          tier,
          duelId: id,
        }).catch(() => {})
      } else if (tier === "FREE") {
        const { logMissedEarnings } = await import("@/lib/missedEarnings")
        await logMissedEarnings(entry.userId, Math.round(CREDIT_CONFIG.EARN.POST_VOTE * 1), {
          source: "duel_vote",
          entryId,
          voterId: user.id,
          duelId: id,
        }).catch(() => {})
      }
    }
  } catch {
    // earn failures never break the vote
  }

  const { trackFeatureEvent } = await import("@/lib/credits")
  await trackFeatureEvent({ userId: user.id, type: "duel_vote", metadata: { duelId: id, entryId } }).catch(() => {})

  return NextResponse.json({ success: true, votes: updatedVotes })
}
