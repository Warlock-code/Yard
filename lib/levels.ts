// Ghost levels (XP) — free engagement driver + level-gated cosmetics.
// XP = posts×10 + yeahs×2 + battleVotes×3 + streak×5 + referrals×20 +
// followers. Levels gate cosmetics/themes/identity items; the ladder is the
// single source of truth for both the profile API and the shop/avatar paths.
import { AVATAR_MAP, type AvatarRarity } from "@/lib/avatars"

export const LEVELS = [
  { level: 1, xp: 0, title: "Newbie", emoji: "👻" },
  { level: 2, xp: 100, title: "Rising Ghost", emoji: "🌫️" },
  { level: 3, xp: 350, title: "Elite Ghost", emoji: "💨" },
  { level: 4, xp: 800, title: "Phantom", emoji: "⚔️" },
  { level: 5, xp: 1500, title: "Wraith", emoji: "💀" },
  { level: 6, xp: 3000, title: "Legend", emoji: "👑" },
] as const

export type GhostLevel = (typeof LEVELS)[number]

// Status Ladder unlock gates. Keep shop copy and API guards importing these
// constants so the requirements can never drift apart.
export const AVATAR_RARITY_UNLOCK_LEVEL: Record<AvatarRarity, number> = {
  common: 1,
  rare: 2,
  epic: 3,
  legendary: 6,
}

export const THEME_UNLOCK_LEVEL = 4
export const IDENTITY_UNLOCK_LEVEL = 5

// Time-boxed perks per level (cumulative).
const LEVEL_PERKS: Record<number, string[]> = {
  6: ["gold_name_30d"], // gold name color, 30 days, free
}

export function xpForActivity(input: {
  postCount: number
  yeahs: number
  battleVotes: number
  streakCount: number
  referralCount: number
  followersCount: number
}): number {
  return (
    input.postCount * 10 +
    input.yeahs * 2 +
    input.battleVotes * 3 +
    input.streakCount * 5 +
    input.referralCount * 20 +
    input.followersCount
  )
}

export function levelForXp(xp: number): GhostLevel {
  return [...LEVELS].reverse().find((l) => xp >= l.xp) ?? LEVELS[0]
}

export type LevelProgress = {
  /** Numeric level, e.g. 3. */
  currentLevel: number
  /** Display name for the current level, e.g. "Elite Ghost". */
  levelName: string
  emoji: string
  /** Lifetime XP (same value the thresholds above are compared against). */
  currentXp: number
  /** Total XP threshold for the current level. */
  currentLevelXp: number
  /** Total XP threshold needed to reach the next level (equals current XP at max). */
  nextLevelXp: number
  /** Display name for the next level. */
  nextLevelName: string
  /** Remaining XP until the next level. */
  xpToNextLevel: number
  /** 0–100 progress toward the next level. */
  progressPct: number
  isMaxLevel: boolean
}

/**
 * Full Status Ladder snapshot for a user's XP total: current level, current
 * XP, the XP threshold for the next level, and the next level's name.
 */
export function calculateLevel(xp: number): LevelProgress {
  const currentXp = Math.max(0, Number.isFinite(xp) ? xp : 0)
  const current = levelForXp(currentXp)
  const index = LEVELS.findIndex((l) => l.level === current.level)
  const next = LEVELS[index + 1]

  if (!next) {
    return {
      currentLevel: current.level,
      levelName: current.title,
      emoji: current.emoji,
      currentXp,
      currentLevelXp: current.xp,
      nextLevelXp: currentXp,
      nextLevelName: current.title,
      xpToNextLevel: 0,
      progressPct: 100,
      isMaxLevel: true,
    }
  }

  const progressPct = Math.min(100, Math.max(0, (currentXp / next.xp) * 100))

  return {
    currentLevel: current.level,
    levelName: current.title,
    emoji: current.emoji,
    currentXp,
    currentLevelXp: current.xp,
    nextLevelXp: next.xp,
    nextLevelName: next.title,
    xpToNextLevel: Math.max(0, next.xp - currentXp),
    progressPct: Math.round(progressPct * 10) / 10,
    isMaxLevel: false,
  }
}

export function requiredLevelForAvatarRarity(rarity: AvatarRarity): number {
  return AVATAR_RARITY_UNLOCK_LEVEL[rarity]
}

export function requiredLevelForAvatar(avatarId: string): number | null {
  const avatar = AVATAR_MAP[avatarId]
  return avatar ? requiredLevelForAvatarRarity(avatar.rarity) : null
}

// Back-compat name used by the shop catalog API: the lowest level required
// to buy/use an avatar (not a free grant level).
export function levelUnlockLevel(avatarId: string): number | null {
  return requiredLevelForAvatar(avatarId)
}

// All time-boxed perks unlocked by reaching `level` (cumulative).
export function unlockedPerks(level: number): string[] {
  const perks: string[] = []
  for (const [lvl, arr] of Object.entries(LEVEL_PERKS)) {
    if (Number(lvl) <= level) perks.push(...arr)
  }
  return perks
}

// Time-boxed profile perk check. Gold-name flags are stored as
// `profile:color_name:gold:{expiryMs}`; permanent purchases are the plain
// `profile:color_name` key. Expired gold flags read as absent (a future
// renderer must call this instead of a raw includes()).
export function profilePerkActive(owned: string[], key: "profile:color_name"): boolean {
  if (owned.includes(key)) return true
  const prefix = `${key}:gold:`
  for (const c of owned) {
    if (!c.startsWith(prefix)) continue
    const ms = Number(c.slice(prefix.length))
    if (Number.isSafeInteger(ms) && ms > Date.now()) return true
  }
  return false
}

export function goldNameFlag(expiryMs: number) {
  return `profile:color_name:gold:${expiryMs}`
}

// Human-readable ladder for shop/profile modals: what each level unlocks and
// the total XP required to get there.
export const LEVEL_UNLOCK_DISPLAY: {
  level: number
  title: string
  emoji: string
  xp: number
  unlocks: string
  grants: string
}[] = LEVELS.map((l) => {
  const unlocks =
    l.level === 1
      ? "Common avatars"
      : l.level === 2
        ? "Rare avatars"
        : l.level === 3
          ? "Epic avatars"
          : l.level === 4
            ? "Themes"
            : l.level === 5
              ? "Identity items (custom name, banners, verified badge)"
              : "Legendary avatars + 30-day gold name"
  return { level: l.level, title: l.title, emoji: l.emoji, xp: l.xp, unlocks, grants: unlocks }
})

// Legacy export name (typo kept for any older imports).
export const LEVEL_UPLOCK_DISPLAY = LEVEL_UNLOCK_DISPLAY
