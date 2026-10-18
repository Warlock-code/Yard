import { NextResponse } from "next/server"
import { prisma } from "@/lib/prisma"
import { CREDIT_CONFIG } from "@/lib/credit-config"
import { Prisma } from "@prisma/client"

export { CREDIT_CONFIG, getAllPacks } from "@/lib/credit-config"
export type { CreditConfig } from "@/lib/credit-config"

// Credits are a virtual in-app currency for entertainment only — no monetary
// value, never redeemable for cash. WITHDRAWAL is a legacy transaction type
// kept for history; no code path may ever write it.

// Global rule: whenever a user can't afford a credit action, the client must
// send them to the shop to buy credits. Servers flag it with 402 +
// needsCredits; the shared api client redirects to SHOP_HREF.
export const SHOP_HREF = "/shop"

export function isInsufficientCreditsError(err: unknown) {
  return err instanceof Error && err.message === "Insufficient credits"
}

export function needsCreditsResponse(message = "not enough credits — top up in the shop to continue.") {
  return NextResponse.json(
    { error: message, needsCredits: true, shopHref: SHOP_HREF },
    { status: 402 }
  )
}

export function toCreditErrorResponse(err: unknown, fallback = "credit action failed.") {
  if (isInsufficientCreditsError(err)) return needsCreditsResponse()
  return NextResponse.json(
    { error: err instanceof Error ? err.message : fallback },
    { status: 400 }
  )
}

export async function trackFeatureEvent(input: {  userId?: string | null
  type: string
  pathname?: string | null
  metadata?: Record<string, unknown>
}) {
  // Analytics for every monetization feature — admin reads via
  // /api/admin/credits?action=feature_events. Never throws.
  try {
    await prisma.analyticsEvent.create({
      data: {
        userId: input.userId ?? null,
        type: input.type.slice(0, 64),
        pathname: input.pathname?.slice(0, 200) ?? null,
        metadata: (input.metadata ?? {}) as Prisma.InputJsonValue,
      },
    })
  } catch {
    // table missing pre-migration — ignore
  }
}

export async function creditUser(
  userId: string,
  type: string,
  amount: number,
  reference?: string,
  metadata?: Record<string, unknown>
): Promise<{ newBalance: number; transactionId: string }> {
  if (amount === 0) throw new Error("Amount cannot be zero")
  if (type === "WITHDRAWAL") throw new Error("Withdrawals are not available. Credits are spendable in-app only.")

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
        ...(amount > 0 && type !== "PURCHASE" && type !== "ADMIN_MINT" && type !== "ADMIN_REFUND"
          ? { creditsEarned: { increment: amount } }
          : {}),
        ...(type === "PURCHASE" ? { creditsPurchased: { increment: amount } } : {}),
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

export async function getUserCredits(userId: string) {
  const user = await prisma.user.findUnique({
    where: { id: userId },
    select: {
      creditsBalance: true,
      creditsEarned: true,
      creditsPurchased: true,
      tier: true,
    },
  })
  return user
}

export async function getCreditTransactions(userId: string, limit = 50, cursor?: string) {
  // MISSED_EARNING shadows are display-only upgrade nudges — never part of the wallet.
  const where: Record<string, unknown> = { userId, NOT: { type: "MISSED_EARNING" } }
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

export async function mintCreditsAdmin(userId: string, amount: number, reason: string, adminId: string) {
  if (amount <= 0) throw new Error("Amount must be positive")
  return creditUser(userId, "ADMIN_MINT", amount, undefined, { reason, adminId })
}

export async function burnCreditsAdmin(userId: string, amount: number, reason: string, adminId: string) {
  if (amount <= 0) throw new Error("Amount must be positive")
  return creditUser(userId, "ADMIN_BURN", -amount, undefined, { reason, adminId })
}

export async function refundCreditsAdmin(userId: string, amount: number, reason: string, adminId: string) {
  // Manual credit refund — returns spendable credits via an ADMIN_REFUND
  // ledger row (never cash). Refunds don't inflate creditsEarned.
  if (amount <= 0) throw new Error("Amount must be positive")
  return creditUser(userId, "ADMIN_REFUND", amount, undefined, { reason, adminId })
}

export async function getTreasuryStats() {
  const [totalBalance, totalEarned, totalPurchased, totalUsers] = await Promise.all([
    prisma.user.aggregate({ _sum: { creditsBalance: true } }),
    prisma.user.aggregate({ _sum: { creditsEarned: true } }),
    prisma.user.aggregate({ _sum: { creditsPurchased: true } }),
    prisma.user.count(),
  ])

  const creditsOutstanding = totalBalance._sum.creditsBalance || 0

  return {
    creditsOutstanding,
    totalEarned: totalEarned._sum.creditsEarned || 0,
    totalPurchased: totalPurchased._sum.creditsPurchased || 0,
    totalUsers,
  }
}

export function getPackById(packId: string) {
  return CREDIT_CONFIG.PACKS.find((p) => p.id === packId)
}

// Tier-aware earn helper — single choke point for turning ON credit earns.
// PLUS earns base × 1, PRIME earns base × 2 (via TIER_MULTIPLIER); FREE
// always earns 0 real credits and gets a display-only MISSED_EARNING shadow
// row via logMissedEarnings instead. Never awards FREE real credits.
export async function awardCredits(input: {
  userId: string
  base: number
  tier: string
  multKey?: "earn" | "battle" | "tipReceived"
  type: string
  reference?: string
  metadata?: Record<string, unknown>
  shadowSource?: string
  shadowMeta?: Record<string, unknown>
  streakMult?: number
}): Promise<{ awarded: number; shadow: number }> {
  const mult =
    CREDIT_CONFIG.TIER_MULTIPLIER[input.tier as keyof typeof CREDIT_CONFIG.TIER_MULTIPLIER]?.[
      input.multKey ?? "earn"
    ] ?? 0
  const reward = Math.round(input.base * mult * (input.streakMult ?? 1))
  if (reward > 0) {
    await creditUser(input.userId, input.type, reward, input.reference, {
      ...(input.metadata ?? {}),
      tier: input.tier,
    })
    return { awarded: reward, shadow: 0 }
  }
  // FREE (or zero-mult) path: shadow only — never touches the wallet.
  const shadow = Math.round(input.base * 1)
  if (shadow > 0) {
    try {
      const { logMissedEarnings } = await import("@/lib/missedEarnings")
      await logMissedEarnings(input.userId, shadow, {
        source: input.shadowSource ?? input.type.toLowerCase(),
        ...(input.shadowMeta ?? {}),
      }).catch(() => {})
    } catch {
      // shadow failures never break the calling flow
    }
  }
  return { awarded: 0, shadow: shadow > 0 ? shadow : 0 }
}

// Streak multiplier — 2x (500cr) or 3x (1,200cr) windows lasting 7 days.
// Applies to streak milestones + battle wins (cold paths only — vote hot
// paths stay lean). Stacks with rush hour.
export async function activeStreakMult(userId: string): Promise<1 | 2 | 3> {
  try {
    const rows = await prisma.creditTransaction.findMany({
      where: { userId, type: "STREAK_MULT", createdAt: { gte: new Date(Date.now() - 7 * 24 * 60 * 60 * 1000) } },
      select: { metadata: true },
      take: 10,
    })
    let best: 1 | 2 | 3 = 1
    for (const r of rows) {
      const m = r.metadata as { mult?: unknown } | null
      if (m?.mult === 3) return 3
      if (m?.mult === 2) best = 2
    }
    return best
  } catch {
    return 1
  }
}