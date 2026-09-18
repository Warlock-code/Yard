import type { AccountTier } from "@prisma/client"

export function isTierActive(user: { tier: AccountTier; tierExpiresAt: Date | null }): boolean {
  if (user.tier === "FREE") return false
  if (!user.tierExpiresAt) return false
  return user.tierExpiresAt.getTime() > Date.now()
}

export function getEffectiveTier(user: { tier: AccountTier; tierExpiresAt: Date | null }): AccountTier {
  return isTierActive(user) ? user.tier : "FREE"
}

export function getTierDaysLeft(user: { tierExpiresAt: Date | null }): number | null {
  if (!user.tierExpiresAt) return null
  const diff = user.tierExpiresAt.getTime() - Date.now()
  return Math.max(0, Math.ceil(diff / (24 * 60 * 60 * 1000)))
}

/**
 * Extend tier from max(now, currentExpiry) + 31 days.
 * Use inside a prisma.$transaction callback with db param.
 */
export async function extendTierInTx(
  db: any,
  userId: string,
  tier: AccountTier
) {
  const u = await db.user.findUnique({ where: { id: userId }, select: { tierExpiresAt: true } })
  const base = Math.max(Date.now(), u?.tierExpiresAt?.getTime() ?? 0)
  const next = new Date(base + 31 * 24 * 60 * 60 * 1000)
  await db.user.update({ where: { id: userId }, data: { tier, tierExpiresAt: next } })
  return next
}
