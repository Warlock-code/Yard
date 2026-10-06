import { NextRequest, NextResponse } from "next/server"
import { prisma } from "@/lib/prisma"
import { verifyToken } from "@/lib/auth"
import { getEffectiveTier, getTierDaysLeft, getEffectiveStorageLimitMB } from "@/lib/tier"
import { getChampionTrophies } from "@/lib/champions"

export const dynamic = "force-dynamic"

export async function GET(req: NextRequest) {
  const token = req.cookies.get("yard_token")?.value
  if (!token) return NextResponse.json({ user: null })

  const payload = verifyToken(token)
  if (!payload) return NextResponse.json({ user: null })

  const user = await prisma.user.findUnique({ where: { id: payload.userId } })
  if (!user || user.status !== "ACTIVE") return NextResponse.json({ user: null })

  // Parallel fan-out: was 6 sequential round-trips, now 1 wave
  const [postCount, followersCount, followingCount, earningsSum, paidOutSum, pendingPayout, trophiesMap] = await Promise.all([
    prisma.post.count({ where: { userId: user.id } }),
    prisma.follow.count({ where: { followingId: user.id } }),
    prisma.follow.count({ where: { followerId: user.id } }),
    prisma.earning.aggregate({ where: { userId: user.id }, _sum: { amount: true } }),
    prisma.payout.aggregate({ where: { userId: user.id, status: { in: ["approved", "paid"] } }, _sum: { amount: true } }),
    prisma.payout.findFirst({ where: { userId: user.id, status: "pending" }, select: { id: true } }),
    getChampionTrophies([{ id: user.id, campus: user.campus }]).catch(() => new Map<string, number>()),
  ])

  const totalEarned = earningsSum._sum.amount || 0
  const totalPaidOut = paidOutSum._sum.amount || 0
  const effectiveTier = getEffectiveTier(user)
  const daysLeft = user.tier !== "FREE" ? getTierDaysLeft(user) : null
  const effectiveStorageLimit = getEffectiveStorageLimitMB(user)
  const championTrophies = trophiesMap.get(user.id) ?? 0

  return NextResponse.json({
    user: {
      id: user.id,
      email: user.email,
      ghostId: user.ghostId,
      avatarEmoji: user.avatarEmoji,
      campus: user.campus,
      program: user.program,
      cohortYear: user.cohortYear,
      tier: effectiveTier,
      rawTier: user.tier,
      tierExpiresAt: user.tierExpiresAt,
      tierDaysLeft: daysLeft,
      streakCount: user.streakCount,
      ghostCoins: user.ghostCoins,
      creditsBalance: user.creditsBalance,
      ownedCosmetics: user.ownedCosmetics,
      // Owned-page consumables (additive — existing clients ignore new fields).
      freeBoosts: user.freeBoosts,
      streakFreezeUntil: user.streakFreezeUntil,
      purchasedStorageMB: Math.max(0, user.storageLimit - 50),
      postCount,
      followersCount,
      followingCount,
      totalEarnedPesewas: totalEarned,
      availableBalancePesewas: totalEarned - totalPaidOut,
      hasPendingPayout: !!pendingPayout,
      storageUsed: Math.max(0, user.storageUsed),
      storageLimit: effectiveStorageLimit,
      storageRemaining: Math.max(0, effectiveStorageLimit - user.storageUsed),
      championTrophies,
    },
  })
}