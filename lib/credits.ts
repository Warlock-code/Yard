import { prisma } from "@/lib/prisma"
import { CREDIT_CONFIG, CreditConfig } from "@/lib/credit-config"
import { Prisma } from "@prisma/client"

export { CREDIT_CONFIG } from "@/lib/credit-config"
export type { CreditConfig } from "@/lib/credit-config"

export async function creditUser(
  userId: string,
  type: string,
  amount: number,
  reference?: string,
  metadata?: Record<string, unknown>
): Promise<{ newBalance: number; transactionId: string }> {
  if (amount === 0) throw new Error("Amount cannot be zero")

  const result = await prisma.$transaction(async (tx) => {
    const user = await tx.user.findUnique({
      where: { id: userId },
      select: { creditsBalance: true },
    })
    if (!user) throw new Error("User not found")

    const newBalance = user.creditsBalance + amount
    if (newBalance < 0) throw new Error("Insufficient credits")

    const transaction = await tx.creditTransaction.create({
      data: {
        userId,
        type,
        amount,
        balanceAfter: newBalance,
        reference,
        metadata: metadata as Prisma.InputJsonValue,
      },
    })

    await tx.user.update({
      where: { id: userId },
      data: {
        creditsBalance: newBalance,
        ...(amount > 0 && type !== "PURCHASE" && type !== "ADMIN_MINT"
          ? { creditsEarned: { increment: amount } }
          : {}),
        ...(type === "PURCHASE" ? { creditsPurchased: { increment: amount } } : {}),
        ...(type === "WITHDRAWAL" ? { creditsWithdrawn: { increment: -amount } } : {}),
      },
    })

    return { newBalance, transactionId: transaction.id }
  })

  return result
}

export async function purchaseCredits(
  userId: string,
  packId: string,
  paystackReference: string
): Promise<{ creditsAdded: number; newBalance: number }> {
  const pack = CREDIT_CONFIG.PACKS.find((p) => p.id === packId)
  if (!pack) throw new Error("Invalid pack")

  const { newBalance } = await creditUser(userId, "PURCHASE", pack.credits, paystackReference, {
    packId,
    ghsAmount: pack.ghs,
    bonusPct: pack.bonusPct,
  })

  return { creditsAdded: pack.credits, newBalance }
}

export async function withdrawCredits(
  userId: string,
  creditsAmount: number,
  bankCode: string,
  accountNumber: string,
  accountName: string
): Promise<{ payoutId: string; netGhsAmount: number }> {
  const user = await prisma.user.findUnique({
    where: { id: userId },
    select: {
      creditsBalance: true,
      creditsEarned: true,
      creditsWithdrawn: true,
      createdAt: true,
      kycStatus: true,
      tier: true,
    },
  })
  if (!user) throw new Error("User not found")

  // Validation
  if (creditsAmount < CREDIT_CONFIG.MIN_WITHDRAWAL_CREDITS) {
    throw new Error(`Minimum withdrawal is ${CREDIT_CONFIG.MIN_WITHDRAWAL_CREDITS} credits (GHS ${CREDIT_CONFIG.MIN_WITHDRAWAL_GHS})`)
  }
  if (creditsAmount > user.creditsBalance) {
    throw new Error("Insufficient credits balance")
  }
  if (user.kycStatus !== "APPROVED" && CREDIT_CONFIG.LIMITS.KYC_REQUIRED) {
    throw new Error("KYC verification required before withdrawal")
  }
  const accountAgeDays = (Date.now() - user.createdAt.getTime()) / (1000 * 60 * 60 * 24)
  if (accountAgeDays < CREDIT_CONFIG.LIMITS.MIN_ACCOUNT_AGE_DAYS) {
    throw new Error(`Account must be at least ${CREDIT_CONFIG.LIMITS.MIN_ACCOUNT_AGE_DAYS} days old`)
  }
  if (user.creditsEarned < CREDIT_CONFIG.LIMITS.MIN_EARNED_CREDITS_TO_WITHDRAW) {
    throw new Error(`Must earn at least ${CREDIT_CONFIG.LIMITS.MIN_EARNED_CREDITS_TO_WITHDRAW} credits before withdrawal`)
  }

  const tierConfig = CREDIT_CONFIG.TIER_MULTIPLIER[user.tier as keyof typeof CREDIT_CONFIG.TIER_MULTIPLIER] || CREDIT_CONFIG.TIER_MULTIPLIER.FREE
  const feePct = tierConfig.withdrawalFee
  const ghsAmount = Math.floor((creditsAmount / CREDIT_CONFIG.CREDITS_PER_GHS) * 100) // pesewas
  const feeAmount = Math.floor(ghsAmount * feePct / 100)
  const netGhsAmount = ghsAmount - feeAmount

  // Daily withdrawal limit check
  const dayStart = new Date()
  dayStart.setHours(0, 0, 0, 0)
  const dayEnd = new Date(dayStart)
  dayEnd.setDate(dayEnd.getDate() + 1)
  const todayWithdrawn = await prisma.creditPayout.aggregate({
    where: {
      userId,
      status: { in: ["pending", "processing", "approved", "paid"] },
      requestedAt: { gte: dayStart, lt: dayEnd },
    },
    _sum: { ghsAmount: true },
  })
  const todayTotal = (todayWithdrawn._sum.ghsAmount || 0) + ghsAmount
  if (todayTotal > CREDIT_CONFIG.LIMITS.MAX_DAILY_WITHDRAWAL_GHS * 100) {
    throw new Error(`Daily withdrawal limit exceeded (GHS ${CREDIT_CONFIG.LIMITS.MAX_DAILY_WITHDRAWAL_GHS})`)
  }

  const result = await prisma.$transaction(async (tx) => {
    // Deduct credits
    await creditUser(userId, "WITHDRAWAL", -creditsAmount, undefined, {
      ghsAmount,
      feePct,
      feeAmount,
      netGhsAmount,
    })

    // Create payout record
    const payout = await tx.creditPayout.create({
      data: {
        userId,
        creditsAmount,
        ghsAmount,
        feePct,
        feeAmount,
        netGhsAmount,
        bankCode,
        accountNumber,
        accountName,
      },
    })

    return { payoutId: payout.id, netGhsAmount: netGhsAmount / 100 }
  })

  return result
}

export async function getUserCredits(userId: string) {
  const user = await prisma.user.findUnique({
    where: { id: userId },
    select: {
      creditsBalance: true,
      creditsEarned: true,
      creditsPurchased: true,
      creditsWithdrawn: true,
      kycStatus: true,
      kycData: true,
      tier: true,
    },
  })
  return user
}

export async function getCreditTransactions(userId: string, limit = 50, cursor?: string) {
  const where: Record<string, unknown> = { userId }
  if (cursor) where.id = { lt: cursor }

  const transactions = await prisma.creditTransaction.findMany({
    where,
    orderBy: { createdAt: "desc" },
    take: limit + 1,
  })

  let nextCursor: string | null = null
  if (transactions.length > limit) {
    const last = transactions.pop()
    nextCursor = last!.id
  }

  return { transactions, nextCursor }
}

export async function getCreditPayouts(userId: string) {
  return prisma.creditPayout.findMany({
    where: { userId },
    orderBy: { requestedAt: "desc" },
  })
}

export async function mintCreditsAdmin(userId: string, amount: number, reason: string, adminId: string) {
  if (amount <= 0) throw new Error("Amount must be positive")
  return creditUser(userId, "ADMIN_MINT", amount, undefined, { reason, adminId })
}

export async function burnCreditsAdmin(userId: string, amount: number, reason: string, adminId: string) {
  if (amount <= 0) throw new Error("Amount must be positive")
  return creditUser(userId, "ADMIN_BURN", -amount, undefined, { reason, adminId })
}

export async function getTreasuryStats() {
  const [
    totalBalance,
    totalEarned,
    totalPurchased,
    totalWithdrawn,
    pendingPayouts,
    totalUsers,
  ] = await Promise.all([
    prisma.user.aggregate({ _sum: { creditsBalance: true } }),
    prisma.user.aggregate({ _sum: { creditsEarned: true } }),
    prisma.user.aggregate({ _sum: { creditsPurchased: true } }),
    prisma.user.aggregate({ _sum: { creditsWithdrawn: true } }),
    prisma.creditPayout.aggregate({
      where: { status: { in: ["pending", "processing"] } },
      _sum: { ghsAmount: true, netGhsAmount: true, feeAmount: true },
    }),
    prisma.user.count(),
  ])

  const creditsOutstanding = totalBalance._sum.creditsBalance || 0
  const liabilityGhs = creditsOutstanding / CREDIT_CONFIG.CREDITS_PER_GHS
  const cashInBank = (totalPurchased._sum.creditsPurchased || 0) / CREDIT_CONFIG.CREDITS_PER_GHS * 0.975 // after Paystack
  const reserveRatio = liabilityGhs > 0 ? cashInBank / liabilityGhs : 0

  return {
    creditsOutstanding,
    liabilityGhs,
    cashInBank,
    reserveRatio,
    totalEarned: totalEarned._sum.creditsEarned || 0,
    totalPurchased: totalPurchased._sum.creditsPurchased || 0,
    totalWithdrawn: totalWithdrawn._sum.creditsWithdrawn || 0,
    pendingPayouts: {
      count: await prisma.creditPayout.count({ where: { status: { in: ["pending", "processing"] } } }),
      totalGhs: (pendingPayouts._sum.ghsAmount || 0) / 100,
      totalNetGhs: (pendingPayouts._sum.netGhsAmount || 0) / 100,
      totalFees: (pendingPayouts._sum.feeAmount || 0) / 100,
    },
    totalUsers,
  }
}

export function getPackById(packId: string) {
  return CREDIT_CONFIG.PACKS.find((p) => p.id === packId)
}

export function getAllPacks() {
  return CREDIT_CONFIG.PACKS.filter((p) => p.isActive).sort((a, b) => a.sortOrder - b.sortOrder)
}