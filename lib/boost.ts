/**
 * Single source of truth for 24h boost expiry.
 * Boosts last exactly 24h: set at boost time as now + 24h,
 * and considered active only while boostedUntil > now.
 * The stored `boosted` boolean is a convenience flag — it must
 * always be interpreted through `isBoostActive`, and cleared
 * by the expiry cron once it lapses so stale rows can't leak
 * a "Boosted" badge into search/trending/profile.
 */

export const BOOST_DURATION_MS = 24 * 60 * 60 * 1000

type BoostLike = {
  boostedUntil?: Date | string | null
}

function toTime(value: Date | string | null | undefined): number {
  if (value instanceof Date) return value.getTime()
  if (typeof value === "string") {
    const t = new Date(value).getTime()
    return t
  }
  return NaN
}

export function isBoostActive(
  post: BoostLike | null | undefined,
  now: Date = new Date()
): boolean {
  if (!post) return false
  const bt = toTime(post.boostedUntil)
  if (!Number.isFinite(bt)) return false
  return bt > now.getTime()
}

export function getBoostExpiry(from: Date = new Date()): Date {
  return new Date(from.getTime() + BOOST_DURATION_MS)
}

/** Max `boostedUntil` allowed from now (caps seeds that used +7d). */
export function getMaxBoostExpiry(from: Date = new Date()): Date {
  return new Date(from.getTime() + BOOST_DURATION_MS)
}
