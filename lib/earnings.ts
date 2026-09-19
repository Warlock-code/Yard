import { prisma } from "@/lib/prisma"
import { getEffectiveTier } from "@/lib/tier"

const PLATFORM_CUT = 0.3
const DAILY_CAP_PESEWAS = 1500

export async function awardEarning(
  userId: string,
  source: string,
  sourceId: string,
  grossAmount: number
) {
  const user = await prisma.user.findUnique({
    where: { id: userId },
    select: { tier: true, tierExpiresAt: true },
  })
  if (!user) return null

  const effectiveTier = getEffectiveTier(user)
  if (effectiveTier !== "PRIME") return null

  const existing = await prisma.earning.findFirst({ where: { userId, source, sourceId } })
  if (existing) return existing

  const todayStart = new Date()
  todayStart.setHours(0, 0, 0, 0)

  const todaySum = await prisma.earning.aggregate({
    where: { userId, createdAt: { gte: todayStart } },
    _sum: { amount: true },
  })
  const earnedToday = todaySum._sum.amount || 0
  if (earnedToday >= DAILY_CAP_PESEWAS) return null

  const net = Math.round(grossAmount * (1 - PLATFORM_CUT))
  const capped = Math.min(net, DAILY_CAP_PESEWAS - earnedToday)
  if (capped <= 0) return null

  return prisma.earning.create({ data: { userId, source, sourceId, amount: capped } })
}