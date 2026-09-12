import { NextRequest, NextResponse } from "next/server"
import { prisma } from "@/lib/prisma"
import { getCurrentUser } from "@/lib/getCurrentUser"

const PESEWAS_PER_BATTLE_VOTE = 10 // battle votes worth more — higher stakes

export async function POST(req: NextRequest) {
  const user = await getCurrentUser(req)
  if (!user) return NextResponse.json({ error: "Not authenticated." }, { status: 401 })

  const { entryId } = await req.json()

  try {
    const entry = await prisma.$transaction(async (tx) => {
      await tx.vote.create({ data: { entryId, userId: user.id } })
      return tx.battleEntry.update({
        where: { id: entryId },
        data: { votes: { increment: 1 } },
      })
    })

    const owner = await prisma.user.findUnique({ where: { id: entry.userId } })
    if (owner && owner.tier === "PRIME") {
      await prisma.earning.create({
        data: {
          userId: owner.id,
          source: "battle_win",
          sourceId: entry.id,
          amount: PESEWAS_PER_BATTLE_VOTE,
        },
      })
    }
  } catch (err: any) {
    if (err.code === "P2002") {
      return NextResponse.json({ error: "You already voted on this entry." }, { status: 400 })
    }
    throw err
  }

  return NextResponse.json({ success: true })
}