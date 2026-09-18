import { NextRequest, NextResponse } from "next/server"
import { prisma } from "@/lib/prisma"
import { getCurrentUser } from "@/lib/getCurrentUser"
import { awardEarning } from "@/lib/earnings"
import { emitBattleVote } from "@/server/socket"

const PESEWAS_PER_BATTLE_VOTE = 10

export async function POST(req: NextRequest) {
  const user = await getCurrentUser(req)
  if (!user) return NextResponse.json({ error: "Not authenticated." }, { status: 401 })

  const { entryId } = await req.json()
  if (typeof entryId !== "string" || !entryId) {
    return NextResponse.json({ error: "Entry required." }, { status: 400 })
  }

  let updatedVotes: number
  let promptId: string

  try {
    await prisma.$transaction(async (tx) => {
      const candidate = await tx.battleEntry.findUnique({ where: { id: entryId }, include: { prompt: true } })
      const now = new Date()
      if (!candidate || candidate.userId === user.id || candidate.campus !== user.campus ||
        candidate.prompt.campus !== user.campus || !candidate.prompt.active ||
        candidate.prompt.startsAt > now || candidate.prompt.endsAt <= now) {
        throw new Error("INVALID_BATTLE_VOTE")
      }
      await tx.vote.create({ data: { entryId, userId: user.id } })
      const updatedEntry = await tx.battleEntry.update({ where: { id: entryId }, data: { votes: { increment: 1 } } })

      updatedVotes = updatedEntry.votes
      promptId = updatedEntry.promptId

      const owner = await tx.user.findUnique({ where: { id: candidate.userId } })
      if (owner && owner.tier === "PRIME") {
        await awardEarning(owner.id, "battle_win", entryId, PESEWAS_PER_BATTLE_VOTE)
      }
    })
  } catch (err: unknown) {
    if (err instanceof Error && err.message === "INVALID_BATTLE_VOTE") {
      return NextResponse.json({ error: "You cannot vote on this battle entry." }, { status: 400 })
    }
    if (typeof err === "object" && err !== null && "code" in err && err.code === "P2002") {
      return NextResponse.json({ error: "You already voted on this entry." }, { status: 400 })
    }
    throw err
  }

  emitBattleVote(promptId!, entryId, updatedVotes!)

  return NextResponse.json({ success: true })
}