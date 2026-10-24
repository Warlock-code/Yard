// Server-only user level lookup. Kept separate from lib/levels.ts so client
// components can import the pure Status Ladder without pulling in Prisma.
import { prisma } from "@/lib/prisma"
import {
  LEVELS,
  calculateLevel,
  levelForXp,
  unlockedPerks,
  xpForActivity,
  type GhostLevel,
  type LevelProgress,
} from "@/lib/levels"

// Full level snapshot for a user (best-effort — falls back to level 1).
export async function userLevelInfo(userId: string): Promise<{
  xp: number
  level: GhostLevel
  progress: LevelProgress
  perks: string[]
}> {
  try {
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
    const progress = calculateLevel(xp)
    return { xp, level: levelForXp(xp), progress, perks: unlockedPerks(progress.currentLevel) }
  } catch {
    const progress = calculateLevel(0)
    return { xp: 0, level: LEVELS[0], progress, perks: [] }
  }
}
