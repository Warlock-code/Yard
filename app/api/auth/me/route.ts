import { NextRequest, NextResponse } from "next/server"
import { prisma } from "@/lib/prisma"
import { verifyToken } from "@/lib/auth"

export async function GET(req: NextRequest) {
  const token = req.cookies.get("yard_token")?.value
  if (!token) return NextResponse.json({ user: null })

  const payload = verifyToken(token)
  if (!payload) return NextResponse.json({ user: null })

  const user = await prisma.user.findUnique({ where: { id: payload.userId } })
  if (!user) return NextResponse.json({ user: null })

  const postCount = await prisma.post.count({ where: { userId: user.id } })
  const followersCount = await prisma.follow.count({ where: { followingId: user.id } })
  const followingCount = await prisma.follow.count({ where: { followerId: user.id } })

  const earningsSum = await prisma.earning.aggregate({
    where: { userId: user.id },
    _sum: { amount: true },
  })

  const paidOutSum = await prisma.payout.aggregate({
    where: { userId: user.id, status: { in: ["approved", "paid"] } },
    _sum: { amount: true },
  })

  const pendingPayout = await prisma.payout.findFirst({
    where: { userId: user.id, status: "pending" },
  })

  const totalEarned = earningsSum._sum.amount || 0
  const totalPaidOut = paidOutSum._sum.amount || 0

  return NextResponse.json({
    user: {
      id: user.id,
      email: user.email,
      ghostId: user.ghostId,
      avatarEmoji: user.avatarEmoji,
      campus: user.campus,
      program: user.program,
      tier: user.tier,
      streakCount: user.streakCount,
      ghostCoins: user.ghostCoins,
      ownedCosmetics: user.ownedCosmetics,
      postCount,
      followersCount,
      followingCount,
      totalEarnedPesewas: totalEarned,
      availableBalancePesewas: totalEarned - totalPaidOut,
      hasPendingPayout: !!pendingPayout,
      storageUsed: Math.max(0, user.storageUsed),
      storageLimit: user.storageLimit,
      storageRemaining: Math.max(0, user.storageLimit - user.storageUsed),
    },
  })
}