import { NextRequest, NextResponse } from "next/server"
import { prisma } from "@/lib/prisma"
import { getCurrentUser } from "@/lib/getCurrentUser"
import { isBoostActive } from "@/lib/boost"
import { createNotification } from "@/lib/notifications"
import { evalHotPostNudge } from "@/lib/nudges"
import { getReadablePostWhere } from "@/lib/programAccess"
import { emitVoteUpdate } from "@/lib/socket-client"
import { creditUser, CREDIT_CONFIG } from "@/lib/credits"
import { getEffectiveTier } from "@/lib/tier"
import { isRushLive, RUSH_MULTIPLIER } from "@/lib/rush"

const MILESTONES = [10, 50, 100, 500, 1000]
const MILESTONE_BONUS_PESEWAS: Record<number, number> = { 10: 50, 50: 200, 100: 500, 500: 2000, 1000: 5000 }

export async function POST(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params
  const user = await getCurrentUser(req)
  if (!user) return NextResponse.json({ error: "not authenticated." }, { status: 401 })

  const targetPost = await prisma.post.findFirst({ where: { id, AND: [await getReadablePostWhere(user)] } })
  if (!targetPost) return NextResponse.json({ error: "post not found." }, { status: 404 })
  if (targetPost.userId === user.id) {
    return NextResponse.json({ error: "you can't vote on your own post." }, { status: 403 })
  }

  try {
    await prisma.postVote.create({ data: { postId: id, userId: user.id } })
  } catch (err: unknown) {
    if (typeof err === "object" && err !== null && "code" in err && err.code === "P2002") {
      return NextResponse.json({ error: "you already voted on this post." }, { status: 400 })
    }
    throw err
  }

  const post = await prisma.post.update({ where: { id }, data: { yeahs: { increment: 1 } } })
  const owner = await prisma.user.findUnique({ where: { id: post.userId } })

  if (owner) {
    const tier = getEffectiveTier(owner)
    const multiplier = CREDIT_CONFIG.TIER_MULTIPLIER[tier as keyof typeof CREDIT_CONFIG.TIER_MULTIPLIER]?.earn || 0
    if (multiplier > 0) {
      // Rush hour: votes pay double (free tier still earns 0 — no farming).
      const rush = isRushLive()
      const rushMult = rush ? RUSH_MULTIPLIER : 1
      const voteReward = Math.round(CREDIT_CONFIG.EARN.POST_VOTE * multiplier * rushMult)

      await creditUser(owner.id, "VOTE_REWARD", voteReward, post.id, { postId: post.id, voterId: user.id, tier, rush })
      
      if (MILESTONES.includes(post.yeahs)) {
        const milestoneBonus = Math.round(MILESTONE_BONUS_PESEWAS[post.yeahs] / 100 * CREDIT_CONFIG.CREDITS_PER_GHS * multiplier * rushMult)
        await creditUser(owner.id, "VOTE_REWARD", milestoneBonus, post.id, { 
          postId: post.id, 
          milestone: post.yeahs,
          tier,
          rush,
        })
      }
    }
  }

  if (owner && !MILESTONES.includes(post.yeahs)) {
    await createNotification({
      userId: owner.id,
      pushToken: owner.pushToken,
      type: "like",
      title: "your post got a yeah",
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
      title: "your post is popping",
      body: `${post.yeahs} yeahs and climbing - check it out.`,
      href: `/post/${post.id}`,
    })
    // Victory ask (fires exactly once per post — yeahs hits 10 a single
    // time): strike while they're proud, funnel to the lair invite link.
    // Higher milestones stay celebration-only so this never nags.
    if (post.yeahs === 10) {
      await createNotification({
        userId: owner.id,
        pushToken: owner.pushToken,
        type: "invite_nudge",
        title: "your gist is blowing up 🔥",
        body: "10 yeahs and climbing — invite your hostel to see it. your link lives in your lair.",
        href: "/lair",
      })
    }
  }

  emitVoteUpdate(post.campus, post.id, post.yeahs)

  // Smart nudge: post heating up -> "boost it for 24h with credits" (fire-and-forget)
  evalHotPostNudge(post.id).catch(() => {})

  return NextResponse.json({ post: { ...post, boosted: isBoostActive(post) } })
}