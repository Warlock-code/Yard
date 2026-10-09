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
  if (tier === "PRIME") return avatarRarity === "common" || avatarRarity === "rare"
  return false
}

export function getTierAvatars(tier: AccountTier) {
  if (tier === "FREE") return []
  return AVATARS.filter((a) => canAccessAvatar(tier, a.rarity)).map((a) => a.id)
}

export function getWeeklyBoostGrant(tier: AccountTier): number {
  switch (tier) {
    case "PRIME": return 2
    case "PLUS": return 1
    default: return 0
  }
}

export function getMonthlyFreezeGrant(tier: AccountTier): number {
  switch (tier) {
    case "PRIME": return 2
    case "PLUS": return 1
    default: return 0
  }
}

export function getTierStorageBonusMB(tier: AccountTier): number {
  switch (tier) {
    case "PRIME": return 100
    case "PLUS": return 50
    default: return 0
  }
}

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
  if (effectiveTier === "FREE") return false
  const now = new Date()
  if (!user.lastFreeFreezeGrant) return true
  const lastGrant = new Date(user.lastFreeFreezeGrant)
  // One grant per calendar month.
  return lastGrant.getFullYear() !== now.getFullYear() || lastGrant.getMonth() !== now.getMonth()
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
      "Unlocks common avatars free (Snake, Alien, Cat, Dog, Panda, Frog, Owl, Penguin, Octopus)",
      "Blue checkmark on profile and posts",
      "Higher battle priority",
      "1 free post boost per week",
      "1 free streak freeze per month",
      "Post hints: see which programs watch your posts",
      "Can buy rare/epic/legendary avatars and shop items",
      "Can buy custom ghost name",
      "50 MB storage bonus (100 MB total)",
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
      "All common & rare avatars unlocked free",
      "Gold checkmark + Prime badge on profile and posts",
      "Highest feed + battle priority",
      "2x credit rewards from votes, tips, referrals, streaks (credits spendable in-app on boosts, pins and shop items — no cash payouts)",
      "Full post hints: programs + class years + follower context",
      "Full analytics dashboard (prime exclusive)",
      "2 free post boosts per week",
      "2 free streak freezes per month",
      "100 MB storage bonus (150 MB total)",
      "Gold theme",
    ],
  },
} as const