import { NextRequest, NextResponse } from "next/server"
import { prisma } from "@/lib/prisma"
import { getCurrentUser } from "@/lib/getCurrentUser"

export const dynamic = "force-dynamic"

export async function GET(req: NextRequest) {
  const user = await getCurrentUser(req)
  if (!user) return NextResponse.json({ error: "Not authenticated." }, { status: 401 })

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
          include: { user: { select: { ghostId: true, avatarEmoji: true, tier: true } } },
        },
        winnerEntry: {
          include: { user: { select: { ghostId: true, avatarEmoji: true, tier: true } } },
        },
        season: { select: { id: true, name: true } },
        childPrompts: {
          orderBy: { roundNumber: "asc" },
          include: {
            entries: { orderBy: { votes: "desc" }, take: 1 },
            winnerEntry: { include: { user: { select: { ghostId: true, avatarEmoji: true, tier: true } } } },
          },
        },
      },
    })

    return NextResponse.json({ battles: prompts })
  }

  if (promptId) {
    const prompt = await prisma.battlePrompt.findUnique({
      where: { id: promptId },
      include: {
        entries: {
          orderBy: { votes: "desc" },
          include: { user: { select: { ghostId: true, avatarEmoji: true, tier: true } } },
        },
        winnerEntry: {
          include: { user: { select: { ghostId: true, avatarEmoji: true, tier: true } } },
        },
        season: { select: { id: true, name: true } },
        childPrompts: {
          orderBy: { roundNumber: "asc" },
          include: {
            entries: { orderBy: { votes: "desc" }, include: { user: { select: { ghostId: true, avatarEmoji: true, tier: true } } } },
            winnerEntry: { include: { user: { select: { ghostId: true, avatarEmoji: true, tier: true } } } },
          },
        },
        parentPrompt: {
          include: {
            entries: { orderBy: { votes: "desc" }, include: { user: { select: { ghostId: true, avatarEmoji: true, tier: true } } } },
            winnerEntry: { include: { user: { select: { ghostId: true, avatarEmoji: true, tier: true } } } },
          },
        },
      },
    })

    if (!prompt || prompt.campus !== user.campus) {
      return NextResponse.json({ error: "Battle not found." }, { status: 404 })
    }

    const userVote = await prisma.vote.findFirst({
      where: { userId: user.id, entry: { promptId: prompt.id } },
      select: { entryId: true },
    })

    return NextResponse.json({ prompt, userVote: userVote?.entryId })
  }

  const now = new Date()
  let prompt = await prisma.battlePrompt.findFirst({
    where: {
      campus: user.campus,
      active: true,
      status: { in: ["ACTIVE", "VOTING"] },
      startsAt: { lte: now },
      endsAt: { gt: now },
    },
    orderBy: { startsAt: "desc" },
    include: {
      entries: {
        orderBy: { votes: "desc" },
        include: { user: { select: { ghostId: true, avatarEmoji: true, tier: true } } },
      },
      season: { select: { id: true, name: true } },
      childPrompts: {
        orderBy: { roundNumber: "asc" },
        include: {
          entries: { orderBy: { votes: "desc" }, take: 1 },
          winnerEntry: { include: { user: { select: { ghostId: true, avatarEmoji: true, tier: true } } } },
        },
      },
    },
  })

  if (!prompt) {
    const upcoming = await prisma.battlePrompt.findFirst({
      where: { campus: user.campus, status: "UPCOMING", startsAt: { gt: now } },
      orderBy: { startsAt: "asc" },
    })
    if (upcoming) {
      return NextResponse.json({ prompt: upcoming, entries: [], upcoming: true })
    }
    return NextResponse.json({ prompt: null, entries: [] })
  }

  if (prompt.earlyAccessForPrime && prompt.status === "UPCOMING" && user.tier !== "PRIME") {
    return NextResponse.json({ prompt, entries: [], earlyAccess: true })
  }

  if (prompt.isPrimeOnly && user.tier !== "PRIME") {
    return NextResponse.json({ prompt, entries: [], primeOnly: true })
  }

  const userVote = await prisma.vote.findFirst({
    where: { userId: user.id, entry: { promptId: prompt.id } },
    select: { entryId: true },
  })

  return NextResponse.json({ prompt, entries: prompt.entries, userVote: userVote?.entryId })
}