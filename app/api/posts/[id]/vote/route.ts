import { NextRequest, NextResponse } from "next/server"
import { prisma } from "@/lib/prisma"
import { getCurrentUser } from "@/lib/getCurrentUser"
import { awardEarning } from "@/lib/earnings"
import { sendPush } from "@/lib/sendPush"

const PESEWAS_PER_VOTE = 5
const MILESTONES = [10, 50, 100, 500, 1000]
const MILESTONE_BONUS_PESEWAS: Record<number, number> = { 10: 50, 50: 200, 100: 500, 500: 2000, 1000: 5000 }

export async function POST(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params
  const user = await getCurrentUser(req)
  if (!user) return NextResponse.json({ error: "Not authenticated." }, { status: 401 })

  try {
    await prisma.postVote.create({ data: { postId: id, userId: user.id } })
  } catch (err: any) {
    if (err.code === "P2002") {
      return NextResponse.json({ error: "You already voted on this post." }, { status: 400 })
    }
    throw err
  }

  const post = await prisma.post.update({ where: { id }, data: { yeahs: { increment: 1 } } })
  const owner = await prisma.user.findUnique({ where: { id: post.userId } })

  if (owner && owner.tier === "PRIME") {
    await awardEarning(owner.id, "post_vote", post.id, PESEWAS_PER_VOTE)
    if (MILESTONES.includes(post.yeahs)) {
      await awardEarning(owner.id, "milestone_bonus", post.id, MILESTONE_BONUS_PESEWAS[post.yeahs])
    }
  }

  if (owner?.pushToken && MILESTONES.includes(post.yeahs)) {
    await sendPush(owner.pushToken, "Your post is popping 🔥", `${post.yeahs} yeahs and climbing — check it out.`)
  }

  return NextResponse.json({ post })
}