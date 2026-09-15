import { NextRequest, NextResponse } from "next/server"
import { prisma } from "@/lib/prisma"
import { getCurrentUser } from "@/lib/getCurrentUser"
import { awardEarning } from "@/lib/earnings"

const PESEWAS_PER_BATTLE_VOTE = 10

export async function POST(req: NextRequest) {
  const user = await getCurrentUser(req)
  if (!user) return NextResponse.json({ error: "Not authenticated." }, { status: 401 })

  const { entryId } = await req.json()

  try {
    const entry = await prisma.$transaction(async (tx) => {
      await tx.vote.create({ data: { entryId, userId: user.id } })
      return tx.battleEntry.update({ where: { id: entryId }, data: { votes: { increment: 1 } } })
    })

    const owner = await prisma.user.findUnique({ where: { id: entry.userId } })
    if (owner && owner.tier === "PRIME") {
      await awardEarning(owner.id, "battle_win", entry.id, PESEWAS_PER_BATTLE_VOTE)
    }
  } catch (err: any) {
    if (err.code === "P2002") {
      return NextResponse.json({ error: "You already voted on this entry." }, { status: 400 })
    }
    throw err
  }

  return NextResponse.json({ success: true })
}