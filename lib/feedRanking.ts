import type { AccountTier } from "@prisma/client"
import { getTierPriority } from "./tier"

export type FeedRankingCandidate = {
  id: string
  userId: string
  campus: string
  programKey: string | null
  yeahs: number
  commentsCount: number
  createdAt: Date
  boostedUntil?: Date | null
  // Ranking-only tier boost: author's tier + expiry. Accepts either flat
  // fields or the nested Prisma `user` relation (feed route passes posts
  // with `include: { user: { select: { tier, tierExpiresAt } } }`).
  // Missing/expired => FREE (weight 1). No UI/badge effect.
  authorTier?: AccountTier | string | null
  authorTierExpiresAt?: Date | string | null
  user?: { tier?: AccountTier | string | null; tierExpiresAt?: Date | string | null } | null
}

export type FeedRankingViewer = {
  campus: string
  programKey: string | null
  followingIds: ReadonlySet<string>
}

export function rankFeedCandidates<T extends FeedRankingCandidate>(
  candidates: readonly T[],
  viewer: FeedRankingViewer,
  snapshotAt: Date,
  tieSeed?: string,
): T[] {
  const snapshotTime = snapshotAt.getTime()
  if (!Number.isFinite(snapshotTime)) throw new RangeError("Invalid feed snapshot timestamp")

  const ranked = candidates.map((candidate) => {
    const createdTime = candidate.createdAt.getTime()
    if (!Number.isFinite(createdTime)) throw new RangeError("Invalid candidate timestamp")

    const ageHours = Math.max(0, snapshotTime - createdTime) / 3_600_000
    const yeahs = Number.isFinite(candidate.yeahs) ? Math.max(0, candidate.yeahs) : 0
    const comments = Number.isFinite(candidate.commentsCount) ? Math.max(0, candidate.commentsCount) : 0
    const engagement = Math.log1p(yeahs) + 2 * Math.log1p(comments)
    const followRelevance = viewer.followingIds.has(candidate.userId) ? 2 : 0
    const programRelevance = viewer.programKey && candidate.campus === viewer.campus
      && candidate.programKey === viewer.programKey ? 1 : 0
    let score = (1 + engagement + followRelevance + programRelevance) / (1 + ageHours / 12) ** 1.5

    // Boost multiplier: active only if boostedUntil > snapshotAt (deterministic)
    const boostedUntil = candidate.boostedUntil
    if (boostedUntil instanceof Date) {
      const bt = boostedUntil.getTime()
      if (Number.isFinite(bt) && bt > snapshotTime) {
        score *= 1.8
      }
    }

    // Per-refresh shuffle: deterministic jitter keyed by seed + post id,
    // ±2% of score. Near-tied posts rotate every refresh — boosted ones
    // included (jitter applies after the boost multiplier, so the boosted
    // cluster shuffles internally while staying above genuinely colder
    // posts). Posts with real score gaps hold their order.
    // No seed = legacy deterministic order.
    let tieJitter = 0
    if (tieSeed) {
      tieJitter = (hash01(`${tieSeed}:${candidate.id}`) - 0.5) * 0.04 * (1 + score)
    }

    // Tier boost (ranking only): effective tier at snapshot time, mirroring
    // getEffectiveTier() but against snapshotTime (not Date.now()) so ranking
    // stays deterministic within a refreshSeed session. PRIME = 3, PLUS = 2,
    // FREE/expired = 1. Applied as a PRIMARY sort key below (not a score
    // multiplier): tier decides the bucket, the engagement/boost score decides
    // order inside the bucket. Jitter therefore only rotates within a tier and
    // can never push a FREE post above a PLUS/PRIME one.
    const tierWeight = getCandidateTierWeight(candidate, snapshotTime)

    return { candidate, createdTime, score: score + tieJitter, tierWeight }
  })

  return ranked
    .filter(({ createdTime }) => createdTime <= snapshotTime)
    .sort((a, b) => b.tierWeight - a.tierWeight || b.score - a.score || b.createdTime - a.createdTime
      || (a.candidate.id < b.candidate.id ? -1 : a.candidate.id > b.candidate.id ? 1 : 0))
    .map(({ candidate }) => candidate)
}

/** Effective-tier weight at snapshot time (mirrors getEffectiveTier + getTierPriority). */
function getCandidateTierWeight(candidate: FeedRankingCandidate, snapshotTime: number): number {
  const rawTier = candidate.authorTier ?? candidate.user?.tier ?? "FREE"
  if (rawTier !== "PLUS" && rawTier !== "PRIME") return 1
  const expiresAt = candidate.authorTierExpiresAt ?? candidate.user?.tierExpiresAt ?? null
  if (!expiresAt) return 1
  const expiryTime = expiresAt instanceof Date ? expiresAt.getTime() : new Date(expiresAt).getTime()
  if (!Number.isFinite(expiryTime) || expiryTime <= snapshotTime) return 1
  return getTierPriority(rawTier as AccountTier)
}

/** Deterministic FNV-1a hash mapped to [0, 1) for seeded tie rotation. */
function hash01(key: string): number {
  let hash = 0x811c9dc5
  for (let i = 0; i < key.length; i++) {
    hash ^= key.charCodeAt(i)
    hash = Math.imul(hash, 0x01000193)
  }
  return (hash >>> 0) / 0x100000000
}
