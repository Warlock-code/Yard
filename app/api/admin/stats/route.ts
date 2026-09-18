import { NextRequest, NextResponse } from "next/server"
import { prisma } from "@/lib/prisma"
import { isAdmin } from "@/lib/getAdmin"

export const dynamic = "force-dynamic"

export async function GET(req: NextRequest) {
  if (!isAdmin(req)) return NextResponse.json({ error: "Not authorized." }, { status: 403 })

  const [userCount, postCount, primeCount, plusCount, revenueSum, pendingPayoutSum, paidOutSum] = await Promise.all([
    prisma.user.count(),
    prisma.post.count(),
    prisma.user.count({ where: { tier: "PRIME" } }),
    prisma.user.count({ where: { tier: "PLUS" } }),
    prisma.transaction.aggregate({ where: { status: "success" }, _sum: { amount: true } }),
    prisma.payout.aggregate({ where: { status: { in: ["pending", "processing", "approved"] } }, _sum: { amount: true } }),
    prisma.payout.aggregate({ where: { status: "paid" }, _sum: { amount: true } }),
  ])

    const sevenDaysAgo = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000)
  const [activePosters, activeCommenters, activeVoters] = await Promise.all([
    prisma.post.findMany({ where: { createdAt: { gte: sevenDaysAgo } }, select: { userId: true }, distinct: ["userId"] }),
    prisma.comment.findMany({ where: { createdAt: { gte: sevenDaysAgo } }, select: { userId: true }, distinct: ["userId"] }),
    prisma.postVote.findMany({ where: { createdAt: { gte: sevenDaysAgo } }, select: { userId: true }, distinct: ["userId"] }),
  ])
  const activeUserIds = new Set([
    ...activePosters.map((p) => p.userId),
    ...activeCommenters.map((c) => c.userId),
    ...activeVoters.map((v) => v.userId),
  ])

  return NextResponse.json({
    userCount,
    postCount,
    primeCount,
    plusCount,
    activeUsers: activeUserIds.size,
    revenuePesewas: revenueSum._sum.amount || 0,
    pendingPayoutPesewas: pendingPayoutSum._sum.amount || 0,
    paidOutPesewas: paidOutSum._sum.amount || 0,
  })
}