export type FeedRankingCandidate = {
  id: string
  userId: string
  campus: string
  programKey: string | null
  yeahs: number
  commentsCount: number
  createdAt: Date
  boostedUntil?: Date | null
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

    return { candidate, createdTime, score }
  })

  return ranked
    .filter(({ createdTime }) => createdTime <= snapshotTime)
    .sort((a, b) => b.score - a.score || b.createdTime - a.createdTime
      || (a.candidate.id < b.candidate.id ? -1 : a.candidate.id > b.candidate.id ? 1 : 0))
    .map(({ candidate }) => candidate)
}
