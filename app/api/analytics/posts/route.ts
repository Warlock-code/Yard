import { NextRequest, NextResponse } from "next/server"
import { prisma } from "@/lib/prisma"
import { getCurrentUser } from "@/lib/getCurrentUser"
import { isBoostActive } from "@/lib/boost"

export const dynamic = "force-dynamic"

function parseDateRange(searchParams: URLSearchParams) {
  const range = searchParams.get("range") || "30d"
  const now = new Date()
  let startDate: Date

  switch (range) {
    case "7d":
      startDate = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000)
      break
    case "30d":
      startDate = new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000)
      break
    case "90d":
      startDate = new Date(now.getTime() - 90 * 24 * 60 * 60 * 1000)
      break
    case "all":
      startDate = new Date(0)
      break
    default:
      startDate = new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000)
  }

  const customStart = searchParams.get("start")
  const customEnd = searchParams.get("end")
  if (customStart) startDate = new Date(customStart)
  const endDate = customEnd ? new Date(customEnd) : now

  return { startDate, endDate, range }
}

export async function GET(req: NextRequest) {
  const user = await getCurrentUser(req)
  if (!user) return NextResponse.json({ error: "Not authenticated." }, { status: 401 })

  if (user.tier !== "PRIME") {
    void prisma.paywallHit.create({ data: { userId: user?.id ?? null, feature: "analytics", pathname: req.nextUrl?.pathname ?? null } }).catch(()=>{})
    return NextResponse.json({ error: "Prime subscription required." }, { status: 403 })
  }

  const { startDate, endDate, range } = parseDateRange(new URL(req.url).searchParams)

  const posts = await prisma.post.findMany({
    where: {
      userId: user.id,
      createdAt: { gte: startDate, lte: endDate },
      archived: false,
    },
    orderBy: { createdAt: "desc" },
    select: {
      id: true,
      text: true,
      imageUrl: true,
      type: true,
      yeahs: true,
      commentsCount: true,
      createdAt: true,
      boosted: true,
      boostedUntil: true,
    },
  })

  const postIds = posts.map((p) => p.id)

  const [views, earnings, postVotes] = await Promise.all([
    prisma.postView.groupBy({
      by: ["postId"],
      where: { postId: { in: postIds } },
      _count: { postId: true },
    }),
    prisma.earning.groupBy({
      by: ["sourceId"],
      where: { userId: user.id, source: "post_vote", sourceId: { in: postIds } },
      _sum: { amount: true },
    }),
    prisma.postVote.groupBy({
      by: ["postId"],
      where: { postId: { in: postIds } },
      _count: { postId: true },
    }),
  ])

  const viewMap = new Map(views.map((v) => [v.postId, v._count.postId]))
  const earningsMap = new Map(earnings.map((e) => [e.sourceId!, e._sum.amount || 0]))
  const voteMap = new Map(postVotes.map((v) => [v.postId, v._count.postId]))

  const postPerformance = posts.map((post) => {
    const viewsCount = viewMap.get(post.id) || 0
    const yeahs = voteMap.get(post.id) || 0
    const comments = post.commentsCount
    const earningsAmount = earningsMap.get(post.id) || 0
    const engagementRate = viewsCount > 0 ? ((yeahs + comments) / viewsCount) * 100 : 0
    const earningsPerView = viewsCount > 0 ? earningsAmount / viewsCount : 0

    return {
      id: post.id,
      text: post.text?.slice(0, 150) || "",
      imageUrl: post.imageUrl,
      type: post.type,
      views: viewsCount,
      yeahs,
      comments,
      engagementRate: Math.round(engagementRate * 100) / 100,
      earnings: earningsAmount,
      earningsPerView: Math.round(earningsPerView * 100) / 100,
      createdAt: post.createdAt,
      boosted: isBoostActive(post),
    }
  })

  const totalViews = postPerformance.reduce((s, p) => s + p.views, 0)
  const totalYeahs = postPerformance.reduce((s, p) => s + p.yeahs, 0)
  const totalComments = postPerformance.reduce((s, p) => s + p.comments, 0)
  const totalEarnings = postPerformance.reduce((s, p) => s + p.earnings, 0)
  const avgEngagementRate = postPerformance.length > 0
    ? postPerformance.reduce((s, p) => s + p.engagementRate, 0) / postPerformance.length
    : 0

  return NextResponse.json({
    range,
    summary: {
      totalPosts: posts.length,
      totalViews,
      totalYeahs,
      totalComments,
      totalEarnings,
      avgEngagementRate: Math.round(avgEngagementRate * 100) / 100,
    },
    posts: postPerformance,
  })
}