import { NextRequest, NextResponse } from "next/server"
import { prisma } from "@/lib/prisma"
import { getCurrentUser } from "@/lib/getCurrentUser"
import { getEffectiveTier } from "@/lib/tier"
import { creditUser, toCreditErrorResponse, trackFeatureEvent, CREDIT_CONFIG } from "@/lib/credits"

export const dynamic = "force-dynamic"

// Accept an open ghost duel: pay 500cr, post your take. First acceptor wins
// the second slot (1v1). Named duels only open to the named ghost.
export async function POST(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params
  const user = await getCurrentUser(req)
  if (!user) return NextResponse.json({ error: "not authenticated." }, { status: 401 })

  const body = await req.json().catch(() => ({}))
  const take = typeof body.take === "string" ? body.take.trim().toLowerCase() : ""
  if (!take) return NextResponse.json({ error: "your take is required." }, { status: 400 })
  if (take.length > 500) return NextResponse.json({ error: "takes must be 500 characters or fewer." }, { status: 400 })

  const prompt = await prisma.battlePrompt.findUnique({
    where: { id },
    include: { entries: { select: { id: true, userId: true } } },
  })
  const now = new Date()
  if (!prompt || prompt.campus !== user.campus || !prompt.active || prompt.status !== "ACTIVE" || prompt.endsAt <= now) {
    return NextResponse.json({ error: "this duel is not open." }, { status: 400 })
  }
  if (prompt.entries.length >= 2) {
    return NextResponse.json({ error: "this duel is already full." }, { status: 400 })
  }
  if (prompt.entries.some((e) => e.userId === user.id)) {
    return NextResponse.json({ error: "you already entered this duel." }, { status: 409 })
  }

  // Named duel? Only the named ghost may accept.
  try {
    const regs = await prisma.analyticsEvent.findMany({
      where: { type: "duel_create", createdAt: { gte: new Date(Date.now() - 7 * 24 * 60 * 60 * 1000) } },
      select: { metadata: true },
      take: 100,
    })
    const reg = regs.find((e) => (e.metadata as { promptId?: unknown } | null)?.promptId === id)
    const named = (reg?.metadata as { opponentGhostId?: unknown } | null)?.opponentGhostId
    if (typeof named === "string" && named && named !== user.ghostId.toLowerCase()) {
      // Ghost ids are stored lowercase; compare case-insensitively.
      if (user.ghostId.toLowerCase() !== named.toLowerCase()) {
        return NextResponse.json({ error: "this duel is for a named ghost." }, { status: 403 })
      }
    }
  } catch {
    // registry unreadable — treat as open
  }

  const fee = CREDIT_CONFIG.SPEND.DUEL_ENTRY
  try {
    await creditUser(user.id, "DUEL_ENTRY", -fee, prompt.id, {
      promptId: prompt.id,
      campus: user.campus,
      tier: getEffectiveTier(user),
    })
  } catch (err) {
    return toCreditErrorResponse(err, "couldn't join the duel.")
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
    if (typeof err === "object" && err !== null && "code" in err && err.code === "P2002") {
      return NextResponse.json({ error: "you already entered this duel." }, { status: 409 })
    }
    return NextResponse.json({ error: "couldn't join the duel. try again." }, { status: 500 })
  }

  await trackFeatureEvent({
    userId: user.id,
    type: "duel_accept",
    pathname: "/battles",
    metadata: { promptId: prompt.id, fee },
  }).catch(() => {})

  return NextResponse.json({ entry, fee, potCredits: fee * 2 })
}
