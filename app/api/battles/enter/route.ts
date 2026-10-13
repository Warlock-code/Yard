import { NextRequest, NextResponse } from "next/server"
import { prisma } from "@/lib/prisma"
import { getCurrentUser } from "@/lib/getCurrentUser"
import { getEffectiveTier } from "@/lib/tier"
import { emitBattleUpdate } from "@/lib/socket-client"
import { attachChampionTrophies } from "@/lib/champions"
import { creditUser, toCreditErrorResponse, trackFeatureEvent, CREDIT_CONFIG } from "@/lib/credits"
import { getRateLimitInfo, rateLimit } from "@/lib/rateLimit"
import type { Prisma } from "@prisma/client"

type BattleEntryCreateInput = Prisma.BattleEntryCreateInput

export async function POST(req: NextRequest) {
  const user = await getCurrentUser(req)
  if (!user) return NextResponse.json({ error: "not authenticated." }, { status: 401 })

  const effectiveTier = getEffectiveTier(user)

  const { promptId, text: rawText, imageUrl, voiceUrl } = await req.json()
  const text = typeof rawText === "string" ? rawText.toLowerCase() : rawText

  if (!promptId || typeof promptId !== "string") {
    return NextResponse.json({ error: "prompt ID required." }, { status: 400 })
  }

  const prompt = await prisma.battlePrompt.findUnique({ where: { id: promptId } })
  const now = new Date()

  if (!prompt || prompt.campus !== user.campus || !prompt.active || prompt.startsAt > now || prompt.endsAt <= now) {
    return NextResponse.json({ error: "this battle is not open for entries." }, { status: 400 })
  }

  const entryType = prompt.entryType
  const entryData: BattleEntryCreateInput = {
    prompt: { connect: { id: promptId } },
    user: { connect: { id: user.id } },
    campus: user.campus,
    isPrime: effectiveTier === "PRIME",
    entryType,
    roundNumber: prompt.roundNumber,
  }

  if (entryType === "TEXT") {
    if (!text?.trim()) return NextResponse.json({ error: "entry text required." }, { status: 400 })
    if (text.trim().length > 500) return NextResponse.json({ error: "entries must be 500 characters or fewer." }, { status: 400 })
    entryData.text = text.trim()
  } else if (entryType === "IMAGE") {
    if (!imageUrl?.trim()) return NextResponse.json({ error: "image URL required." }, { status: 400 })
    entryData.imageUrl = imageUrl.trim()
    entryData.text = text?.trim() || null
  } else if (entryType === "VOICE") {
    if (!voiceUrl?.trim()) return NextResponse.json({ error: "voice URL required." }, { status: 400 })
    entryData.voiceUrl = voiceUrl.trim()
    entryData.text = text?.trim() || null
  }

  let entry
  const fee = CREDIT_CONFIG.SPEND.BATTLE_ENTRY_PREMIUM
  // PRIME free-entry day key: 1 free entry/day, enforced both by the
  // BATTLE_ENTRY_FREE ledger row (metadata day) and this RateLimit key.
  const freeDay = new Date().toISOString().slice(0, 10) // yyyy-mm-dd (UTC)
  const freeKey = `battle-free:${user.id}:${freeDay}`
  let entryPaid = true
  try {
    // Battle pot economy: every entry pays BATTLE_ENTRY_PREMIUM into the pot.
    // PRIME gets 1 free entry/day; everyone else always pays. Winner takes
    // 75% of the pot at settle (see cron/battles), platform keeps 25% rake.
    if (effectiveTier === "PRIME") {
      const dayStart = new Date()
      dayStart.setHours(0, 0, 0, 0)
      const freeUsed = await prisma.creditTransaction.count({
        where: { userId: user.id, type: "BATTLE_ENTRY_FREE", createdAt: { gte: dayStart } },
      })
      const freeInfo = await getRateLimitInfo(freeKey, CREDIT_CONFIG.BATTLE.PRIME_FREE_ENTRIES_PER_DAY, 24 * 60 * 60 * 1000).catch(() => ({ allowed: true }))
      if (freeUsed < CREDIT_CONFIG.BATTLE.PRIME_FREE_ENTRIES_PER_DAY && freeInfo.allowed) {
        entryPaid = false
      }
    }
    if (entryPaid) {
      try {
        await creditUser(user.id, "BATTLE_ENTRY", -fee, promptId, {
          promptId,
          campus: user.campus,
          tier: effectiveTier,
        })
      } catch (err) {
        return toCreditErrorResponse(err, "couldn't join the battle.")
      }
    } else {
      await prisma.creditTransaction.create({
        data: {
          userId: user.id,
          type: "BATTLE_ENTRY_FREE",
          amount: 0,
          balanceAfter: user.creditsBalance,
          reference: promptId,
          metadata: { promptId, campus: user.campus, day: freeDay } as Prisma.InputJsonValue,
        },
      }).catch(() => null)
      // Consume the daily free-entry key so the limit holds even if the
      // ledger write above is dropped pre-migration. Fail-open: never blocks.
      await rateLimit(freeKey, CREDIT_CONFIG.BATTLE.PRIME_FREE_ENTRIES_PER_DAY, 24 * 60 * 60 * 1000).catch(() => true)
    }
    entry = await prisma.battleEntry.create({ data: entryData })
  } catch (error: unknown) {
    if (typeof error === "object" && error !== null && "code" in error && error.code === "P2002") {
      // Entry raced after the fee was taken — refund so nobody pays for nothing.
      if (entryPaid) {
        await creditUser(user.id, "BATTLE_ENTRY", fee, `${promptId}_refund`, {
          promptId,
          refund: true,
        }).catch(() => {})
      }
      return NextResponse.json({ error: "you already entered this battle." }, { status: 409 })
    }
    throw error
  }

  await prisma.battleStats.upsert({
    where: { userId: user.id },
    create: { userId: user.id, totalEntries: 1, totalBattles: 1, lastBattleAt: now },
    update: { totalEntries: { increment: 1 }, totalBattles: { increment: 1 }, lastBattleAt: now },
  })

  const entries = await prisma.battleEntry.findMany({
    where: { promptId },
    orderBy: { votes: "desc" },
    include: { user: { select: { id: true, ghostId: true, avatarEmoji: true, tier: true, campus: true } } },
  })
  const updatedPrompt = await prisma.battlePrompt.findUnique({ where: { id: promptId } })
  await attachChampionTrophies(entries)
  emitBattleUpdate(promptId, {
    id: promptId,
    status: updatedPrompt?.status || "ACTIVE",
    roundNumber: updatedPrompt?.roundNumber || 1,
    endsAt: updatedPrompt?.endsAt?.toISOString() || new Date().toISOString(),
    entries: entries.map((e) => ({
      id: e.id,
      text: e.text,
      votes: e.votes,
      isPrime: e.isPrime,
      user: { ghostId: e.user.ghostId, avatarEmoji: e.user.avatarEmoji, tier: e.user.tier, championTrophies: (e.user as { championTrophies?: number }).championTrophies ?? 0 },
    })),
  })

  const potCredits = entries.length * CREDIT_CONFIG.SPEND.BATTLE_ENTRY_PREMIUM
  await trackFeatureEvent({
    userId: user.id,
    type: "battle_enter",
    pathname: "/battles",
    metadata: { promptId, paid: entryPaid, fee: entryPaid ? fee : 0, potCredits },
  }).catch(() => {})

  return NextResponse.json({ entry, entryPaid, fee: entryPaid ? fee : 0, potCredits })
}