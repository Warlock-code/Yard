import { NextRequest, NextResponse } from "next/server"
import { prisma } from "@/lib/prisma"
import { getCurrentUser } from "@/lib/getCurrentUser"

const PESEWAS_PER_VOTE = 5
const MILESTONES = [10, 50, 100, 500, 1000]
const MILESTONE_BONUS_PESEWAS: Record<number, number> = {
  10: 50,
  50: 200,
  100: 500,
  500: 2000,
  1000: 5000,
}

export async function POST(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params
  const user = await getCurrentUser(req)
  if (!user) return NextResponse.json({ error: "Not authenticated." }, { status: 401 })

  const post = await prisma.post.update({
    where: { id },
    data: { yeahs: { increment: 1 } },
  })

  const owner = await prisma.user.findUnique({ where: { id: post.userId } })

  if (owner && owner.tier === "PRIME") {
    await prisma.earning.create({
      data: { userId: owner.id, source: "post_vote", sourceId: post.id, amount: PESEWAS_PER_VOTE },
    })

    if (MILESTONES.includes(post.yeahs)) {
      await prisma.earning.create({
        data: {
          userId: owner.id,
          source: "milestone_bonus",
          sourceId: post.id,
          amount: MILESTONE_BONUS_PESEWAS[post.yeahs],
        },
      })
    }
  }

  return NextResponse.json({ post })
}