import { NextRequest, NextResponse } from "next/server"
import { prisma } from "@/lib/prisma"
import { getCurrentUser } from "@/lib/getCurrentUser"
import { getEffectiveTier } from "@/lib/tier"
import { emitBattleUpdate } from "@/server/socket"
import type { Prisma } from "@prisma/client"

type BattleEntryCreateInput = Prisma.BattleEntryCreateInput

export async function POST(req: NextRequest) {
  const user = await getCurrentUser(req)
  if (!user) return NextResponse.json({ error: "Not authenticated." }, { status: 401 })

  const effectiveTier = getEffectiveTier(user)

  const { promptId, text, imageUrl, voiceUrl } = await req.json()

  if (!promptId || typeof promptId !== "string") {
    return NextResponse.json({ error: "Prompt ID required." }, { status: 400 })
  }

  const prompt = await prisma.battlePrompt.findUnique({ where: { id: promptId } })
  const now = new Date()

  if (!prompt || prompt.campus !== user.campus || !prompt.active || prompt.startsAt > now || prompt.endsAt <= now) {
    return NextResponse.json({ error: "This battle is not open for entries." }, { status: 400 })
  }

  if (prompt.isPrimeOnly && effectiveTier !== "PRIME") {
    void prisma.paywallHit.create({ data: { userId: user?.id ?? null, feature: "battle", pathname: req.nextUrl?.pathname ?? null } }).catch(()=>{})
    return NextResponse.json({ error: "This battle is for Prime members only." }, { status: 403 })
  }

  if (prompt.earlyAccessForPrime && prompt.status === "UPCOMING" && effectiveTier !== "PRIME") {
    void prisma.paywallHit.create({ data: { userId: user?.id ?? null, feature: "battle", pathname: req.nextUrl?.pathname ?? null } }).catch(()=>{})
    return NextResponse.json({ error: "Early access for Prime members only." }, { status: 403 })
  }

  const entryType = prompt.entryType
  let entryData: BattleEntryCreateInput = {
    prompt: { connect: { id: promptId } },
    user: { connect: { id: user.id } },
    campus: user.campus,
    isPrime: effectiveTier === "PRIME",
    entryType,
    roundNumber: prompt.roundNumber,
  }

  if (entryType === "TEXT") {
    if (!text?.trim()) return NextResponse.json({ error: "Entry text required." }, { status: 400 })
    if (text.trim().length > 500) return NextResponse.json({ error: "Entries must be 500 characters or fewer." }, { status: 400 })
    entryData.text = text.trim()
  } else if (entryType === "IMAGE") {
    if (!imageUrl?.trim()) return NextResponse.json({ error: "Image URL required." }, { status: 400 })
    entryData.imageUrl = imageUrl.trim()
    entryData.text = text?.trim() || null
  } else if (entryType === "VOICE") {
    if (!voiceUrl?.trim()) return NextResponse.json({ error: "Voice URL required." }, { status: 400 })
    entryData.voiceUrl = voiceUrl.trim()
    entryData.text = text?.trim() || null
  }

  let entry
  try {
    entry = await prisma.battleEntry.create({ data: entryData })
  } catch (error: unknown) {
    if (typeof error === "object" && error !== null && "code" in error && error.code === "P2002") {
      return NextResponse.json({ error: "You already entered this battle." }, { status: 409 })
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
    include: { user: { select: { ghostId: true, avatarEmoji: true, tier: true } } },
  })
  const updatedPrompt = await prisma.battlePrompt.findUnique({ where: { id: promptId } })
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
      user: { ghostId: e.user.ghostId, avatarEmoji: e.user.avatarEmoji, tier: e.user.tier },
    })),
  })

  return NextResponse.json({ entry })
}