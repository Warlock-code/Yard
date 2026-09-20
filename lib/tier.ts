import type { AccountTier } from "@prisma/client"
import { AVATARS, type AvatarRarity } from "@/lib/avatars"

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

export function getTierPriority(tier: AccountTier): number {
  switch (tier) {
    case "PRIME": return 3
    case "PLUS": return 2
    default: return 1
  }
}

export function canAccessAvatar(tier: AccountTier, avatarRarity: AvatarRarity): boolean {
  if (tier === "FREE") return false
  if (tier === "PLUS") return avatarRarity === "common"
  if (tier === "PRIME") return avatarRarity === "common"
  return false
}

export function getAvatarPriceForTier(tier: AccountTier, pricePesewas: number, rarity: AvatarRarity): number {
  if (tier === "PRIME" && rarity === "common") return 0
  return pricePesewas
}

export function getTierAvatars(tier: AccountTier) {
  if (tier === "FREE") return []
  return AVATARS.filter((a) => canAccessAvatar(tier, a.rarity)).map((a) => a.id)
}

export function getWeeklyBoostGrant(tier: AccountTier): number {
  switch (tier) {
    case "PLUS": return 1
    case "PRIME": return 2
    default: return 0
  }
}

export function getMonthlyFreezeGrant(tier: AccountTier): number {
  switch (tier) {
    case "PRIME": return 1
    default: return 0
  }
}

/** Extra storage (MB) granted as a tier perk, on top of the base + purchased add-ons.
 *  Not persisted to `user.storageLimit` — computed dynamically so it tracks the
 *  user's *current* effective tier and disappears automatically on downgrade/expiry. */
export function getTierStorageBonusMB(tier: AccountTier): number {
  switch (tier) {
    case "PRIME": return 50
    default: return 0
  }
}

/** `user.storageLimit` (base + purchased add-ons) plus the current tier's storage perk. */
export function getEffectiveStorageLimitMB(user: { tier: AccountTier; tierExpiresAt: Date | null; storageLimit: number }): number {
  return user.storageLimit + getTierStorageBonusMB(getEffectiveTier(user))
}

export function shouldGrantWeeklyBoost(user: { tier: AccountTier; tierExpiresAt: Date | null; lastFreeBoostGrant: Date | null }): boolean {
  const effectiveTier = getEffectiveTier(user)
  if (effectiveTier === "FREE") return false
  const now = new Date()
  if (!user.lastFreeBoostGrant) return true
  const lastGrant = new Date(user.lastFreeBoostGrant)
  const weekStart = new Date(now)
  weekStart.setDate(now.getDate() - now.getDay())
  weekStart.setHours(0, 0, 0, 0)
  return lastGrant < weekStart
}

export function shouldGrantMonthlyFreeze(user: { tier: AccountTier; tierExpiresAt: Date | null; lastFreeFreezeGrant: Date | null }): boolean {
  const effectiveTier = getEffectiveTier(user)
  if (effectiveTier !== "PRIME") return false
  const now = new Date()
  if (!user.lastFreeFreezeGrant) return true
  const lastGrant = new Date(user.lastFreeFreezeGrant)
  const monthStart = new Date(now.getFullYear(), now.getMonth(), 1)
  return lastGrant < monthStart
}

export const TIER_CONFIG = {
  FREE: {
    pricePesewas: 0,
    badge: null,
    color: "text-white/40",
    bgColor: "bg-white/5",
    borderColor: "border-white/10",
    perks: [
      "Default avatar only (👻)",
      "Cannot edit posts",
      "No special badge",
      "Normal battle priority",
      "No earnings / no payouts",
      "Can buy boosts, streak freeze/restore, storage, individual avatars",
      "Can buy custom ghost name",
    ],
  },
  PLUS: {
    pricePesewas: 1000,
    badge: "Plus",
    color: "text-sky-300",
    bgColor: "bg-sky-500/10",
    borderColor: "border-sky-500/30",
    perks: [
      "Edit own posts",
      "Unlocks common avatars (Snake, Alien, Cat, Dog, Panda, Frog, Owl, Penguin, Octopus)",
      "Blue checkmark on profile and posts",
      "Slightly higher battle priority",
      "1 free post boost per week",
      "Can still buy rare/epic/legendary avatars and shop items",
      "Can buy custom ghost name",
    ],
  },
  PRIME: {
    pricePesewas: 2000,
    badge: "Prime",
    color: "text-[#facc15]",
    bgColor: "bg-[#facc15]/10",
    borderColor: "border-[#facc15]/30",
    perks: [
      "Everything in Plus",
      "All common avatars unlocked free",
      "Gold checkmark + Prime banner on profile",
      "Highest battle priority",
      "Real GHS earnings from votes, battle wins, leaderboard",
      "Request payouts (min GHS 20, specific windows)",
      "Full earnings dashboard & analytics",
      "Best storage limits",
      "2 free post boosts per week",
      "1 free streak freeze per month",
    ],
  },
} as const