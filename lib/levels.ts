// Ghost levels (XP) — free engagement driver + level-gated cosmetics.
// XP = posts×10 + yeahs×2 + battleVotes×3 + streak×5 + referrals×20 +
// followers. Levels unlock avatar grants (pushed to ownedCosmetics, never
// charged, never removed) and perks. Single source of truth — both the
// profile API and the shop/avatar grant paths import from here.
export const LEVELS = [
  { level: 1, xp: 0, title: "hatchling", emoji: "👻" },
  { level: 2, xp: 100, title: "wraith", emoji: "🌫️" },
  { level: 3, xp: 300, title: "phantom", emoji: "💨" },
  { level: 4, xp: 600, title: "specter", emoji: "⚔️" },
  { level: 5, xp: 1000, title: "revenant", emoji: "💀" },
  { level: 6, xp: 2000, title: "legend", emoji: "👑" },
] as const

export type GhostLevel = (typeof LEVELS)[number]

// Avatar grants per level (cumulative). Chosen as the cheapest IDs per
// rarity so the house gives away floor value, never premium picks.
const LEVEL_AVATARS: Record<number, string[]> = {
  2: ["avatar_frog", "avatar_owl"], // 2 commons, free
  3: ["avatar_bat"], // 1 rare, free
  4: ["avatar_zombie"], // 1 epic, free
  5: ["avatar_crown"], // 1 legendary, free
}

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

// All avatar IDs unlocked by reaching `level` (cumulative, levels 2+).
export function unlockedAvatarIds(level: number): string[] {
  const ids: string[] = []
  for (const [lvl, arr] of Object.entries(LEVEL_AVATARS)) {
    if (Number(lvl) <= level) ids.push(...arr)
  }
  return ids
}

// All time-boxed perks unlocked by reaching `level` (cumulative).
export function unlockedPerks(level: number): string[] {
  const perks: string[] = []
  for (const [lvl, arr] of Object.entries(LEVEL_PERKS)) {
    if (Number(lvl) <= level) perks.push(...arr)
  }
  return perks
}

// Lowest level that grants `avatarId` via levels, or null if never.
export function levelUnlockLevel(avatarId: string): number | null {
  for (const [lvl, arr] of Object.entries(LEVEL_AVATARS)) {
    if (arr.includes(avatarId)) return Number(lvl)
  }
  return null
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

// Full level snapshot for a user (best-effort — falls back to level 1).
export async function userLevelInfo(userId: string): Promise<{
  xp: number
  level: GhostLevel
  avatarIds: string[]
  perks: string[]
}> {
  try {
    const { prisma } = await import("@/lib/prisma")
    const [postCount, yeahsAgg, battleVotesAgg, u, followersCount] = await Promise.all([
      prisma.post.count({ where: { userId } }),
      prisma.post.aggregate({ where: { userId }, _sum: { yeahs: true } }),
      prisma.battleEntry.aggregate({ where: { userId }, _sum: { votes: true } }),
      prisma.user.findUnique({ where: { id: userId }, select: { streakCount: true, referralCount: true } }),
      prisma.follow.count({ where: { followingId: userId } }),
    ])
    const xp = xpForActivity({
      postCount,
      yeahs: yeahsAgg._sum.yeahs || 0,
      battleVotes: battleVotesAgg._sum.votes || 0,
      streakCount: u?.streakCount || 0,
      referralCount: u?.referralCount || 0,
      followersCount,
    })
    const level = levelForXp(xp)
    return { xp, level, avatarIds: unlockedAvatarIds(level.level), perks: unlockedPerks(level.level) }
  } catch {
    return { xp: 0, level: LEVELS[0], avatarIds: [], perks: [] }
  }
}

// Human-readable unlock map for shop/owned UIs.
export const LEVEL_UPLOCK_DISPLAY: { level: number; title: string; emoji: string; grants: string }[] =
  LEVELS.filter((l) => l.level > 1).map((l) => {
    const avatars = LEVEL_AVATARS[l.level] ?? []
    const perks = LEVEL_PERKS[l.level] ?? []
    const parts: string[] = []
    if (avatars.length > 0) parts.push(`${avatars.length} avatar(s): ${avatars.join(", ")}`)
    if (perks.includes("gold_name_30d")) parts.push("gold name color · 30 days")
    return { level: l.level, title: l.title, emoji: l.emoji, grants: parts.join(" + ") || "bragging rights" }
  })
