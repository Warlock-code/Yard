import { NextRequest, NextResponse } from "next/server"
import { prisma } from "@/lib/prisma"
import { getCurrentUser } from "@/lib/getCurrentUser"
import { getEffectiveTier } from "@/lib/tier"
import { createNotification } from "@/lib/notifications"
import {
  creditUser,
  toCreditErrorResponse,
  trackFeatureEvent,
  CREDIT_CONFIG,
} from "@/lib/credits"

export const dynamic = "force-dynamic"

const DUEL_MS = 24 * 60 * 60 * 1000

// Ghost duel — anonymous 1v1. Challenger puts up 500cr with their take;
// the opponent (named or any campus ghost) answers with 500cr. Spectators
// vote free via POST /api/duels/[id]/vote. Winner takes 75% of the 1,000cr
// pot at settle (cron/battles single-win path), platform keeps 25% rake.
// Everything public + reportable — no DMs, no de-anonymization.
export async function POST(req: NextRequest) {
  const user = await getCurrentUser(req)
  if (!user) return NextResponse.json({ error: "not authenticated." }, { status: 401 })

  const body = await req.json().catch(() => ({}))
  const text = typeof body.text === "string" ? body.text.trim().toLowerCase() : ""
  const take = typeof body.take === "string" ? body.take.trim().toLowerCase() : ""
  const opponentGhostId =
    typeof body.opponentGhostId === "string" ? body.opponentGhostId.trim().toLowerCase() : ""

  if (!text) return NextResponse.json({ error: "duel prompt required." }, { status: 400 })
  if (text.length > 200) return NextResponse.json({ error: "duel prompt must be 200 characters or fewer." }, { status: 400 })
  if (!take) return NextResponse.json({ error: "your take is required." }, { status: 400 })
  if (take.length > 500) return NextResponse.json({ error: "takes must be 500 characters or fewer." }, { status: 400 })

  let opponent: { id: string; ghostId: string } | null = null
  if (opponentGhostId) {
    const found = await prisma.user.findUnique({
      where: { ghostId: opponentGhostId },
      select: { id: true, ghostId: true, campus: true, status: true },
    })
    if (!found || found.id === user.id) {
      return NextResponse.json({ error: "opponent not found." }, { status: 404 })
    }
    if (found.campus !== user.campus || found.status !== "ACTIVE") {
      return NextResponse.json({ error: "you can only duel active ghosts on your campus." }, { status: 400 })
    }
    opponent = { id: found.id, ghostId: found.ghostId }
  }

  const fee = CREDIT_CONFIG.SPEND.DUEL_ENTRY
  const now = new Date()
  const prompt = await prisma.battlePrompt.create({
    data: {
      text: `⚔ duel: ${text}`.slice(0, 220),
      campus: user.campus,
      type: "SINGLE",
      status: "ACTIVE",
      startsAt: now,
      endsAt: new Date(now.getTime() + DUEL_MS),
      roundNumber: 1,
      totalRounds: 1,
      entryType: "TEXT",
    },
  })

  try {
    await creditUser(user.id, "DUEL_ENTRY", -fee, prompt.id, {
      promptId: prompt.id,
      campus: user.campus,
      opponentGhostId: opponent?.ghostId ?? null,
      tier: getEffectiveTier(user),
    })
  } catch (err) {
    await prisma.battlePrompt.delete({ where: { id: prompt.id } }).catch(() => {})
    return toCreditErrorResponse(err, "couldn't start the duel.")
  }

  let entry
  try {
    entry = await prisma.battleEntry.create({
      data: {
        promptId: prompt.id,
        userId: user.id,
        campus: user.campus,
        text: take,
        isPrime: getEffectiveTier(user) === "PRIME",
        entryType: "TEXT",
        roundNumber: 1,
      },
    })
  } catch (err) {
    await creditUser(user.id, "DUEL_ENTRY", fee, `${prompt.id}_refund`, {
      promptId: prompt.id,
      refund: true,
    }).catch(() => {})
    await prisma.battlePrompt.delete({ where: { id: prompt.id } }).catch(() => {})
    return NextResponse.json({ error: "duel failed to start. try again." }, { status: 500 })
  }

  await trackFeatureEvent({
    userId: user.id,
    type: "duel_create",
    pathname: "/battles",
    metadata: { promptId: prompt.id, opponentGhostId: opponent?.ghostId ?? null, fee },
  }).catch(() => {})

  if (opponent) {
    await createNotification({
      userId: opponent.id,
      type: "duel_challenge",
      title: "⚔️ you got duel-challenged!",
        body: `${user.ghostId} put up 500cr — answer with your take within 24h. winner takes 750cr.`,
      href: "/battles",
      actorName: user.ghostId,
    }).catch(() => {})
  }

  return NextResponse.json({ prompt, entry, fee, potCredits: fee })
}

export async function GET(req: NextRequest) {
  const user = await getCurrentUser(req)
  if (!user) return NextResponse.json({ error: "not authenticated." }, { status: 401 })

  // Duel registry = duel_create analytics events (no schema change).
  let promptIds: string[] = []
  try {
    const events = await prisma.analyticsEvent.findMany({
      where: {
        type: "duel_create",
        createdAt: { gte: new Date(Date.now() - 7 * 24 * 60 * 60 * 1000) },
      },
      orderBy: { createdAt: "desc" },
      take: 50,
      select: { metadata: true },
    })
    for (const e of events) {
      const m = e.metadata as { promptId?: unknown } | null
      if (m && typeof m.promptId === "string") promptIds.push(m.promptId)
    }
  } catch {
    return NextResponse.json({ duels: [] })
  }

  if (promptIds.length === 0) return NextResponse.json({ duels: [] })

  const prompts = await prisma.battlePrompt.findMany({
    where: { id: { in: promptIds }, campus: user.campus },
    orderBy: { createdAt: "desc" },
    include: {
      entries: {
        orderBy: { votes: "desc" },
        include: { user: { select: { id: true, ghostId: true, avatarEmoji: true, tier: true } } },
      },
    },
  })

  const fee = CREDIT_CONFIG.SPEND.DUEL_ENTRY
  return NextResponse.json({
    duels: prompts.map((p) => ({
      id: p.id,
      text: p.text,
      status: p.status,
      endsAt: p.endsAt,
      entries: p.entries,
      entryCount: p.entries.length,
      open: p.status === "ACTIVE" && p.entries.length < 2,
      potCredits: p.entries.length * fee,
      winnerPot: Math.floor((p.entries.length * fee * CREDIT_CONFIG.BATTLE.WINNER_PCT) / 100),
    })),
  })
}
