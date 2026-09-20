import { NextRequest, NextResponse } from "next/server"
import { prisma } from "@/lib/prisma"
import { getCurrentUser } from "@/lib/getCurrentUser"
import { isBoostActive } from "@/lib/boost"
import { awardEarning } from "@/lib/earnings"
import { createNotification } from "@/lib/notifications"
import { getReadablePostWhere } from "@/lib/programAccess"
import { emitVoteUpdate } from "@/server/socket"

const PESEWAS_PER_VOTE = 5
const MILESTONES = [10, 50, 100, 500, 1000]
const MILESTONE_BONUS_PESEWAS: Record<number, number> = { 10: 50, 50: 200, 100: 500, 500: 2000, 1000: 5000 }

export async function POST(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params
  const user = await getCurrentUser(req)
  if (!user) return NextResponse.json({ error: "Not authenticated." }, { status: 401 })

  const targetPost = await prisma.post.findFirst({ where: { id, AND: [await getReadablePostWhere(user)] } })
  if (!targetPost) return NextResponse.json({ error: "Post not found." }, { status: 404 })
  if (targetPost.userId === user.id) {
    return NextResponse.json({ error: "You can't vote on your own post." }, { status: 403 })
  }

  try {
    await prisma.postVote.create({ data: { postId: id, userId: user.id } })
  } catch (err: unknown) {
    if (typeof err === "object" && err !== null && "code" in err && err.code === "P2002") {
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

  if (owner && !MILESTONES.includes(post.yeahs)) {
    await createNotification({
      userId: owner.id,
      pushToken: owner.pushToken,
      type: "like",
      title: "Your post got a yeah",
      body: `${user.ghostId} yeahed your post`,
      href: `/post/${post.id}`,
      actorName: user.ghostId,
    })
  }

  if (owner && MILESTONES.includes(post.yeahs)) {
    await createNotification({
      userId: owner.id,
      pushToken: owner.pushToken,
      type: "vote_milestone",
      title: "Your post is popping",
      body: `${post.yeahs} yeahs and climbing - check it out.`,
      href: `/post/${post.id}`,
    })
  }

  emitVoteUpdate(post.campus, post.id, post.yeahs)

  return NextResponse.json({ post: { ...post, boosted: isBoostActive(post) } })
}