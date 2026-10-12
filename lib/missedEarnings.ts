import { prisma } from "@/lib/prisma"

/**
 * Missed-earnings shadow ledger (FREE upgrade nudge).
 * Display-only: never touches creditsBalance / creditsEarned, so no
 * treasury liability and no double-spend risk.
 *
 * Writes:
 *  - CreditTransaction type=MISSED_EARNING, amount=shadow, balanceAfter=unchanged
 *    (weekly sums come from here; UIs must filter this type out of wallets)
 *  - User.missedEarnings += shadow (fast lifetime total; try/catch pre-migration)
 * Best-effort: never throws.
 */
export async function logMissedEarnings(
  userId: string,
  shadow: number,
  meta: Record<string, unknown> = {}
): Promise<void> {
  const amount = Math.floor(shadow)
  if (!Number.isSafeInteger(amount) || amount <= 0) return
  try {
    const user = await prisma.user.findUnique({
      where: { id: userId },
      select: { creditsBalance: true },
    })
    if (!user) return
    await prisma.creditTransaction
      .create({
        data: {
          userId,
          type: "MISSED_EARNING",
          amount,
          balanceAfter: user.creditsBalance,
          metadata: { shadow: true, ...meta } as never,
        },
      })
      .catch(() => null)
    // Fast lifetime counter (column added in 20261012_missed_earnings).
    // try/catch keeps this live-safe if the migration hasn't deployed yet.
    try {
      await prisma.user.update({
        where: { id: userId },
        data: {
          missedEarnings: { increment: amount },
          missedEarningsAt: new Date(),
        },
      })
    } catch {
      // Column not yet migrated — transaction log above is enough.
    }
  } catch {
    // Never break the calling flow (votes/tips/battles).
  }
}

/** Lifetime total: max(counter, transaction sum) so pre-migration shadows aren't lost. */
export async function getMissedTotal(userId: string): Promise<number> {
  let counter = 0
  try {
    const user = await prisma.user.findUnique({
      where: { id: userId },
      select: { missedEarnings: true },
    })
    if (typeof user?.missedEarnings === "number") counter = user.missedEarnings
  } catch {
    counter = 0
  }
  try {
    const agg = await prisma.creditTransaction.aggregate({
      where: { userId, type: "MISSED_EARNING" },
      _sum: { amount: true },
    })
    return Math.max(counter, agg._sum.amount ?? 0)
  } catch {
    return counter
  }
}

/** Sum of shadow earnings since `since` (weekly banner + nudge targeting). */
export async function getMissedSince(userId: string, since: Date): Promise<number> {
  try {
    const agg = await prisma.creditTransaction.aggregate({
      where: { userId, type: "MISSED_EARNING", createdAt: { gte: since } },
      _sum: { amount: true },
    })
    return agg._sum.amount ?? 0
  } catch {
    return 0
  }
}
