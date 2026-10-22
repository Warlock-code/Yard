import { NextRequest, NextResponse } from "next/server"
import { prisma } from "@/lib/prisma"
import { getCurrentUser } from "@/lib/getCurrentUser"
import { attachChampionTrophiesDeep } from "@/lib/champions"

export const dynamic = "force-dynamic"

export async function GET(req: NextRequest) {
  const user = await getCurrentUser(req)
  if (!user) return NextResponse.json({ error: "not authenticated." }, { status: 401 })

  const { searchParams } = new URL(req.url)
  const promptId = searchParams.get("promptId")
  const history = searchParams.get("history") === "true"
  const seasonId = searchParams.get("seasonId")

  if (history) {
    const where: Record<string, unknown> = { campus: user.campus, status: "COMPLETED" }
    if (seasonId) where.seasonId = seasonId

    const prompts = await prisma.battlePrompt.findMany({
      where,
      orderBy: { endsAt: "desc" },
      take: 50,
      include: {
        entries: {
          orderBy: { votes: "desc" },
          take: 3,
          include: { user: { select: { id: true, ghostId: true, avatarEmoji: true, tier: true, campus: true } } },
        },
        winnerEntry: {
          include: { user: { select: { id: true, ghostId: true, avatarEmoji: true, tier: true, campus: true } } },
        },
        season: { select: { id: true, name: true } },
        childPrompts: {
          orderBy: { roundNumber: "asc" },
          include: {
            entries: { orderBy: { votes: "desc" }, take: 1 },
            winnerEntry: { include: { user: { select: { id: true, ghostId: true, avatarEmoji: true, tier: true, campus: true } } } },
          },
        },
      },
    })

    await attachChampionTrophiesDeep(prompts)
    return NextResponse.json({ battles: prompts })
  }

  if (promptId) {
    const prompt = await prisma.battlePrompt.findUnique({
      where: { id: promptId },
      include: {
        entries: {
          orderBy: { votes: "desc" },
          include: { user: { select: { id: true, ghostId: true, avatarEmoji: true, tier: true, campus: true } } },
        },
        winnerEntry: {
          include: { user: { select: { id: true, ghostId: true, avatarEmoji: true, tier: true, campus: true } } },
        },
        season: { select: { id: true, name: true } },
        childPrompts: {
          orderBy: { roundNumber: "asc" },
          include: {
            entries: { orderBy: { votes: "desc" }, include: { user: { select: { id: true, ghostId: true, avatarEmoji: true, tier: true, campus: true } } } },
            winnerEntry: { include: { user: { select: { id: true, ghostId: true, avatarEmoji: true, tier: true, campus: true } } } },
          },
        },
        parentPrompt: {
          include: {
            entries: { orderBy: { votes: "desc" }, include: { user: { select: { id: true, ghostId: true, avatarEmoji: true, tier: true, campus: true } } } },
            winnerEntry: { include: { user: { select: { id: true, ghostId: true, avatarEmoji: true, tier: true, campus: true } } } },
          },
        },
      },
    })

    if (!prompt || prompt.campus !== user.campus) {
      return NextResponse.json({ error: "battle not found." }, { status: 404 })
    }

    const userVote = await prisma.vote.findFirst({
      where: { userId: user.id, entry: { promptId: prompt.id } },
      select: { entryId: true },
    })

    await attachChampionTrophiesDeep(prompt)
    return NextResponse.json({ prompt, userVote: userVote?.entryId })
  }

  const now = new Date()
  const prompt = await prisma.battlePrompt.findFirst({
    where: {
      campus: user.campus,
      active: true,
      status: { in: ["ACTIVE", "VOTING"] },
      startsAt: { lte: now },
      endsAt: { gt: now },
      // Duels are listed in their own section below; never let a user-created
      // duel hijack the official battle card.
      NOT: { text: { startsWith: "⚔ duel:" } },
    },
    orderBy: { startsAt: "desc" },
    include: {
      entries: {
        orderBy: { votes: "desc" },
        include: { user: { select: { id: true, ghostId: true, avatarEmoji: true, tier: true, campus: true } } },
      },
      season: { select: { id: true, name: true } },
      childPrompts: {
        orderBy: { roundNumber: "asc" },
        include: {
          entries: { orderBy: { votes: "desc" }, take: 1 },
          winnerEntry: { include: { user: { select: { id: true, ghostId: true, avatarEmoji: true, tier: true, campus: true } } } },
        },
      },
    },
  })

  if (!prompt) {
    // Only tease prompts that are actually near. Far-future drafts (e.g. the
    // 2030 campus seed pack) must never masquerade as the live battle.
    const soon = new Date(now.getTime() + 7 * 24 * 60 * 60 * 1000)
    const upcoming = await prisma.battlePrompt.findFirst({
      where: {
        campus: user.campus,
        status: "UPCOMING",
        startsAt: { gt: now, lte: soon },
        NOT: { text: { startsWith: "⚔ duel:" } },
      },
      orderBy: { startsAt: "asc" },
    })
    if (upcoming) {
      return NextResponse.json({ prompt: upcoming, entries: [], upcoming: true })
    }
    return NextResponse.json({ prompt: null, entries: [] })
  }

  // Removed Prime-only restrictions

  const userVote = await prisma.vote.findFirst({
    where: { userId: user.id, entry: { promptId: prompt.id } },
    select: { entryId: true },
  })

  await attachChampionTrophiesDeep(prompt)
  return NextResponse.json({ prompt, entries: prompt.entries, userVote: userVote?.entryId })
}