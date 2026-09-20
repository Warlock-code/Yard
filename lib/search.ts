import { prisma } from "@/lib/prisma"
import { Prisma } from "@prisma/client"
import { isBoostActive } from "@/lib/boost"

export const HASHTAG_REGEX = /#(\w+)/g

export function extractHashtags(text: string): string[] {
  const matches = text.match(HASHTAG_REGEX)
  if (!matches) return []
  return [...new Set(matches.map((m) => m.slice(1).toLowerCase()))]
}

export async function processPostHashtags(postId: string, text: string | null | undefined, campus: string) {
  if (!text) return

  const tags = extractHashtags(text)
  if (tags.length === 0) return

  const hashtagData = tags.map((tag) => ({
    tag,
    campus,
  }))

  await prisma.$transaction(async (tx) => {
    for (const { tag, campus } of hashtagData) {
      const hashtag = await tx.hashtag.upsert({
        where: { tag },
        update: {
          postsCount: { increment: 1 },
          lastUsedAt: new Date(),
        },
        create: {
          tag,
          campus,
          postsCount: 1,
        },
      })

      await tx.postHashtag.create({
        data: {
          postId,
          hashtagId: hashtag.id,
        },
      }).catch(() => {})
    }
  })
}

export async function removePostHashtags(postId: string) {
  const postHashtags = await prisma.postHashtag.findMany({
    where: { postId },
    include: { hashtag: true },
  })

  await prisma.$transaction(async (tx) => {
    for (const ph of postHashtags) {
      await tx.postHashtag.delete({ where: { id: ph.id } })

      const remaining = await tx.postHashtag.count({ where: { hashtagId: ph.hashtagId } })
      if (remaining === 0) {
        await tx.hashtag.delete({ where: { id: ph.hashtagId } })
      } else {
        await tx.hashtag.update({
          where: { id: ph.hashtagId },
          data: { postsCount: { decrement: 1 } },
        })
      }
    }
  })
}

export async function updatePostHashtags(postId: string, newText: string | null | undefined, campus: string) {
  await removePostHashtags(postId)
  await processPostHashtags(postId, newText, campus)
}

export interface SearchFilters {
  campus?: string
  program?: string
  programKey?: string
  type?: string
  dateFrom?: string
  dateTo?: string
  hashtag?: string
  userId?: string
  [key: string]: unknown
}

export interface SearchOptions {
  query?: string
  filters?: SearchFilters
  page?: number
  limit?: number
  sortBy?: "relevance" | "recent" | "engagement"
  mediaOnly?: boolean
}

export interface SearchCounts {
  postsTotal: number
  usersTotal: number
  hashtagsTotal: number
}

/**
 * Sanitize raw user input for Prisma search.
 * - trims, caps length, strips control chars, collapses whitespace
 * - never throws; returns "" for empty/invalid input
 */
export function sanitizeSearchQuery(raw: string | null | undefined, maxLen = 100): string {
  if (!raw || typeof raw !== "string") return ""
  const withoutControls = raw.replace(/[\u0000-\u001F\u007F]/g, "")
  const collapsed = withoutControls.replace(/\s+/g, " ").trim()
  return collapsed.slice(0, maxLen)
}

/** Strip leading # / @ sigil used for hashtag / ghost prefix searches. */
export function stripLeadingSigil(q: string): string {
  return q.replace(/^[@#]+/, "").trim()
}

export function clampInt(value: unknown, fallback: number, min: number, max: number): number {
  const n = typeof value === "string" ? parseInt(value, 10) : typeof value === "number" ? value : NaN
  if (!Number.isFinite(n)) return fallback
  return Math.min(max, Math.max(min, Math.floor(n)))
}

function safeDate(value: unknown): Date | undefined {
  if (!value || typeof value !== "string") return undefined
  const d = new Date(value)
  return Number.isNaN(d.getTime()) ? undefined : d
}

export function buildPostWhere(
  query: string,
  filters: SearchFilters = {},
  mediaOnly = false
): Prisma.PostWhereInput {
  const where: Prisma.PostWhereInput = {
    archived: false,
    visibility: "school",
  }

  if (filters.campus) {
    where.campus = filters.campus
  }

  const programKey = filters.programKey ?? filters.program
  if (programKey) {
    where.programKey = programKey
  }

  if (filters.type && filters.type !== "all") {
    where.type = filters.type
  }

  const dateFrom = safeDate(filters.dateFrom)
  const dateTo = safeDate(filters.dateTo)
  if (dateFrom || dateTo) {
    where.createdAt = {}
    if (dateFrom) where.createdAt.gte = dateFrom
    if (dateTo) where.createdAt.lte = dateTo
  }

  if (filters.hashtag) {
    const cleanTag = stripLeadingSigil(sanitizeSearchQuery(filters.hashtag, 50)).toLowerCase()
    if (cleanTag) {
      where.hashtags = {
        some: {
          hashtag: { tag: cleanTag },
        },
      }
    }
  }

  if (filters.userId) {
    where.userId = filters.userId
  }

  if (mediaOnly) {
    where.AND = [
      ...(Array.isArray(where.AND) ? where.AND : where.AND ? [where.AND] : []),
      { imageUrl: { not: null } },
      { NOT: { imageUrl: "" } },
    ]
  }

  const cleanQuery = sanitizeSearchQuery(query, 100)
  // Support "#tag" shorthand: search hashtag relation + text
  if (cleanQuery.startsWith("#")) {
    const tag = stripLeadingSigil(cleanQuery).toLowerCase()
    if (tag) {
      where.OR = [
        { text: { contains: cleanQuery, mode: "insensitive" } },
        { text: { contains: tag, mode: "insensitive" } },
        { hashtags: { some: { hashtag: { tag } } } },
      ]
      return where
    }
  }

  if (cleanQuery) {
    const bare = stripLeadingSigil(cleanQuery)
    where.OR = [
      { text: { contains: bare, mode: "insensitive" } },
      { user: { ghostId: { contains: bare, mode: "insensitive" } } },
    ]
  }

  return where
}

function buildPostOrderBy(
  sortBy: "relevance" | "recent" | "engagement",
  hasQuery: boolean
): Prisma.PostOrderByWithRelationInput | Prisma.PostOrderByWithRelationInput[] {
  // recent => pure recency; relevance (with query) + engagement => engagement-first.
  // This fixes relevance previously collapsing to createdAt-only ordering.
  if (sortBy === "recent") return { createdAt: "desc" }
  if (sortBy === "engagement" || (sortBy === "relevance" && hasQuery)) {
    return [{ yeahs: "desc" }, { commentsCount: "desc" }, { createdAt: "desc" }]
  }
  return { createdAt: "desc" }
}

export async function searchPosts({
  query,
  filters = {},
  page = 1,
  limit = 20,
  sortBy = "relevance",
  mediaOnly = false,
}: SearchOptions) {
  const safePage = clampInt(page, 1, 1, 1000)
  const safeLimit = clampInt(limit, 20, 1, 50)
  const cleanQuery = sanitizeSearchQuery(query ?? "", 100)
  const where = buildPostWhere(cleanQuery, filters, mediaOnly)
  const orderBy = buildPostOrderBy(sortBy, cleanQuery.length > 0)

  const [posts, total] = await Promise.all([
    prisma.post.findMany({
      where,
      orderBy,
      include: {
        user: { select: { id: true, ghostId: true, avatarEmoji: true, tier: true } },
        hashtags: { include: { hashtag: { select: { tag: true } } } },
      },
      skip: (safePage - 1) * safeLimit,
      take: safeLimit,
    }),
    prisma.post.count({ where }),
  ])

  // Wear-off: never trust the stored `boosted` flag — recompute from
  // `boostedUntil` so expired boosts lose the tag + re-rank naturally.
  const now = new Date()
  const normalizedPosts = posts.map((post) => ({
    ...post,
    boosted: isBoostActive(post, now),
  }))

  return {
    posts: normalizedPosts,
    total,
    page: safePage,
    totalPages: total === 0 ? 0 : Math.ceil(total / safeLimit),
  }
}

export async function searchUsers(query: string, campus: string, limit = 10) {
  const clean = stripLeadingSigil(sanitizeSearchQuery(query, 50))
  if (!clean) return []
  const safeLimit = clampInt(limit, 10, 1, 50)

  return prisma.user.findMany({
    where: {
      campus,
      ghostId: { contains: clean, mode: "insensitive" },
      status: "ACTIVE",
    },
    select: {
      id: true,
      ghostId: true,
      avatarEmoji: true,
      tier: true,
      _count: { select: { followers: true, posts: true } },
    },
    take: safeLimit,
    orderBy: [{ followers: { _count: "desc" } }, { ghostId: "asc" }],
  })
}

export async function searchHashtags(query: string, campus: string, limit = 10) {
  const clean = stripLeadingSigil(sanitizeSearchQuery(query, 50)).toLowerCase()
  if (!clean) return []
  const safeLimit = clampInt(limit, 10, 1, 50)

  return prisma.hashtag.findMany({
    where: {
      campus,
      tag: { contains: clean, mode: "insensitive" },
    },
    select: {
      id: true,
      tag: true,
      postsCount: true,
      trendingScore: true,
    },
    take: safeLimit,
    // trendingScore fix: deterministic tie-breakers when scores are stale/zero
    orderBy: [{ trendingScore: "desc" }, { postsCount: "desc" }, { tag: "asc" }],
  })
}

/** Lightweight totals for tab badges. Returns zeros for empty query (empty-q guard). */
export async function countSearchResults(
  query: string,
  campus: string,
  filters: SearchFilters = {}
): Promise<SearchCounts> {
  const clean = sanitizeSearchQuery(query, 100)
  if (!clean) return { postsTotal: 0, usersTotal: 0, hashtagsTotal: 0 }

  const bare = stripLeadingSigil(clean)
  if (!bare) return { postsTotal: 0, usersTotal: 0, hashtagsTotal: 0 }

  const postWhere = buildPostWhere(clean, { ...filters, campus: filters.campus ?? campus })

  const [postsTotal, usersTotal, hashtagsTotal] = await Promise.all([
    prisma.post.count({ where: postWhere }),
    prisma.user.count({
      where: { campus: filters.campus ?? campus, ghostId: { contains: bare, mode: "insensitive" }, status: "ACTIVE" },
    }),
    prisma.hashtag.count({
      where: { campus: filters.campus ?? campus, tag: { contains: bare.toLowerCase(), mode: "insensitive" } },
    }),
  ])

  return { postsTotal, usersTotal, hashtagsTotal }
}

export async function countMediaResults(
  query: string,
  campus: string,
  filters: SearchFilters = {}
): Promise<number> {
  const clean = sanitizeSearchQuery(query, 100)
  if (!clean) return 0
  const where = buildPostWhere(clean, { ...filters, campus: filters.campus ?? campus }, true)
  return prisma.post.count({ where })
}

/** Mixed Top tab: best posts (engagement) + users + hashtags, capped for speed. */
export async function searchTop(query: string, filters: SearchFilters = {}, limit = 5) {
  const clean = sanitizeSearchQuery(query, 100)
  const campus = filters.campus ?? ""
  const slice = clampInt(limit, 5, 1, 5)

  if (!clean || !campus) {
    return { posts: [], users: [], hashtags: [], postsTotal: 0 }
  }

  const [postsResult, users, hashtags] = await Promise.all([
    searchPosts({ query: clean, filters, page: 1, limit: slice, sortBy: "engagement" }),
    searchUsers(clean, campus, slice),
    searchHashtags(clean, campus, slice),
  ])

  return {
    posts: postsResult.posts,
    users,
    hashtags,
    postsTotal: postsResult.total,
  }
}

/**
 * Ranked prefix suggestions for /api/search/suggest.
 * Combines hashtags (#tag), ghostIds (@ghost), user recent queries,
 * and globally popular queries. Returns at most `limit` strings, deduped.
 * Designed for <150ms: 4 small parallel indexed queries, minimal selects.
 */
export async function getRankedSuggestions(
  rawQuery: string,
  campus: string,
  userId: string,
  limit = 7
): Promise<string[]> {
  const safeLimit = clampInt(limit, 7, 1, 10)
  const clean = sanitizeSearchQuery(rawQuery, 50)
  if (!clean) return []
  const bare = stripLeadingSigil(clean)
  if (!bare) return []

  const startsWithHash = clean.startsWith("#")
  const startsWithAt = clean.startsWith("@")

  // Per-type budgets that always sum to safeLimit
  let hashtagTake = 3
  let userTake = 2
  let recentTake = 2
  if (startsWithHash) {
    hashtagTake = Math.min(5, safeLimit - 2)
    userTake = 1
    recentTake = safeLimit - hashtagTake - userTake
  } else if (startsWithAt) {
    userTake = Math.min(4, safeLimit - 2)
    hashtagTake = 2
    recentTake = safeLimit - userTake - hashtagTake
  } else {
    const base = Math.floor(safeLimit / 3)
    hashtagTake = base + (safeLimit % 3 > 0 ? 1 : 0)
    userTake = base + (safeLimit % 3 > 1 ? 1 : 0)
    recentTake = safeLimit - hashtagTake - userTake
  }

  const lowerBare = bare.toLowerCase()

  const [hashtags, users, recentSearches, popular] = await Promise.all([
    prisma.hashtag.findMany({
      where: { campus, tag: { startsWith: lowerBare, mode: "insensitive" } },
      select: { tag: true, postsCount: true, trendingScore: true },
      orderBy: [{ trendingScore: "desc" }, { postsCount: "desc" }, { tag: "asc" }],
      take: Math.max(hashtagTake, 0),
    }),
    prisma.user.findMany({
      where: { campus, ghostId: { startsWith: bare, mode: "insensitive" }, status: "ACTIVE" },
      select: { ghostId: true },
      orderBy: [{ followers: { _count: "desc" } }, { ghostId: "asc" }],
      take: Math.max(userTake, 0),
    }),
    recentTake > 0
      ? prisma.searchHistory.findMany({
          where: { userId, query: { startsWith: clean, mode: "insensitive" } },
          select: { query: true },
          orderBy: { createdAt: "desc" },
          take: recentTake * 2,
        })
      : Promise.resolve([] as { query: string }[]),
    // Global trending phrases: most-searched queries with this prefix
    (async () => {
      try {
        const grouped = await prisma.searchHistory.groupBy({
          by: ["query"],
          where: { query: { startsWith: clean, mode: "insensitive" } },
          _count: { query: true },
          orderBy: { _count: { query: "desc" } },
          take: 3,
        })
        return grouped.map((g) => ({ query: g.query }))
      } catch {
        return [] as { query: string }[]
      }
    })(),
  ])

  const merged: string[] = [
    ...hashtags.map((h) => `#${h.tag}`),
    ...users.map((u) => `@${u.ghostId}`),
    ...popular.map((p) => p.query),
    ...recentSearches.map((r) => r.query),
  ]

  // Dedupe case-insensitively, preserve rank order
  const seen = new Set<string>()
  const unique: string[] = []
  for (const s of merged) {
    const key = s.toLowerCase()
    if (seen.has(key)) continue
    // Drop empty sigils like "#" / "@"
    if (s === "#" || s === "@") continue
    seen.add(key)
    unique.push(s)
    if (unique.length >= safeLimit) break
  }

  return unique
}

export type TrendingWindow = "24h" | "7d"

export function normalizeTrendingWindow(value: unknown): TrendingWindow {
  return value === "7d" ? "7d" : "24h"
}

export function windowSince(window: TrendingWindow): Date {
  const since = new Date()
  if (window === "24h") {
    since.setHours(since.getHours() - 24)
  } else {
    since.setDate(since.getDate() - 7)
  }
  return since
}

export async function getTrendingHashtags(campus: string, window: TrendingWindow = "24h", limit = 10) {
  const safeWindow = normalizeTrendingWindow(window)
  const safeLimit = clampInt(limit, 10, 1, 30)
  const since = windowSince(safeWindow)

  const hashtags = await prisma.hashtag.findMany({
    where: {
      campus,
      lastUsedAt: { gte: since },
      postsCount: { gte: 2 },
    },
    select: {
      id: true,
      tag: true,
      postsCount: true,
      trendingScore: true,
      lastUsedAt: true,
    },
    // trendingScore ordering fix: deterministic tie-breakers for stale/zero scores
    orderBy: [{ trendingScore: "desc" }, { postsCount: "desc" }, { lastUsedAt: "desc" }],
    take: safeLimit,
  })

  return hashtags
}

export async function getTrendingPosts(campus: string, window: TrendingWindow = "24h", limit = 10) {
  const safeWindow = normalizeTrendingWindow(window)
  const safeLimit = clampInt(limit, 10, 1, 30)
  const since = windowSince(safeWindow)

  const posts = await prisma.post.findMany({
    where: {
      campus,
      visibility: "school",
      archived: false,
      createdAt: { gte: since },
    },
    include: {
      user: { select: { id: true, ghostId: true, avatarEmoji: true, tier: true } },
      hashtags: { include: { hashtag: { select: { tag: true } } } },
    },
    orderBy: [{ yeahs: "desc" }, { commentsCount: "desc" }, { createdAt: "desc" }],
    take: safeLimit,
  })

  // Wear-off: recompute tag so expired boosts don't show as Boosted in Explore.
  const now = new Date()
  return posts.map((post) => ({
    ...post,
    boosted: isBoostActive(post, now),
  }))
}

export async function getSuggestedGhosts(userId: string, campus: string, limit = 5) {
  const safeLimit = clampInt(limit, 5, 1, 20)
  const following = await prisma.follow.findMany({
    where: { followerId: userId },
    select: { followingId: true },
  })
  const followingIds = new Set(following.map((f) => f.followingId))
  followingIds.add(userId)

  return prisma.user.findMany({
    where: {
      campus,
      status: "ACTIVE",
      id: { notIn: [...followingIds] },
    },
    select: {
      id: true,
      ghostId: true,
      avatarEmoji: true,
      tier: true,
      _count: { select: { followers: true, posts: true } },
    },
    orderBy: [{ followers: { _count: "desc" } }, { ghostId: "asc" }],
    take: safeLimit,
  })
}

export async function recordSearchHistory(
  userId: string,
  query: string,
  filters: SearchFilters,
  resultsCount: number
) {
  try {
    const clean = sanitizeSearchQuery(query, 100)
    if (!clean) return
    await prisma.searchHistory.create({
      data: {
        userId,
        query: clean,
        filters: filters as unknown as Prisma.InputJsonValue,
        resultsCount,
      },
    })
  } catch {
    // History must never break search
  }
}

export async function getRecentSearches(userId: string, limit = 10) {
  return prisma.searchHistory.findMany({
    where: { userId },
    orderBy: { createdAt: "desc" },
    take: limit,
    select: { id: true, query: true, filters: true, createdAt: true },
  })
}

export async function saveSearch(
  userId: string,
  name: string,
  query: string,
  filters: SearchFilters,
  alertEnabled = false
) {
  return prisma.savedSearch.create({
    data: {
      userId,
      name,
      query,
      filters: filters as unknown as Prisma.InputJsonValue,
      alertEnabled,
    },
  })
}

export async function getSavedSearches(userId: string) {
  return prisma.savedSearch.findMany({
    where: { userId },
    orderBy: { createdAt: "desc" },
  })
}

export async function deleteSavedSearch(userId: string, searchId: string) {
  return prisma.savedSearch.deleteMany({
    where: { id: searchId, userId },
  })
}

export async function updateTrendingScores(campus: string) {
  const since24h = new Date(Date.now() - 24 * 60 * 60 * 1000)
  const since7d = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000)

  const hashtags = await prisma.hashtag.findMany({
    where: { campus },
    select: { id: true, tag: true, postsCount: true, lastUsedAt: true },
  })

  for (const ht of hashtags) {
    const posts24h = await prisma.postHashtag.count({
      where: {
        hashtagId: ht.id,
        post: { createdAt: { gte: since24h }, archived: false },
      },
    })

    const posts7d = await prisma.postHashtag.count({
      where: {
        hashtagId: ht.id,
        post: { createdAt: { gte: since7d }, archived: false },
      },
    })

    const hoursSinceLastUse = (Date.now() - ht.lastUsedAt.getTime()) / (1000 * 60 * 60)
    const recencyBoost = Math.max(0, 1 - hoursSinceLastUse / 168)

    const trendingScore = posts24h * 3 + posts7d * 1 + recencyBoost * 10

    await prisma.hashtag.update({
      where: { id: ht.id },
      data: { trendingScore },
    })
  }
}

export function buildSearchUrl(params: SearchOptions & { tab?: string }): string {
  const urlParams = new URLSearchParams()
  if (params.query) urlParams.set("q", params.query)
  if (params.filters?.campus) urlParams.set("campus", params.filters.campus)
  if (params.filters?.programKey) urlParams.set("program", params.filters.programKey)
  if (params.filters?.type && params.filters.type !== "all") urlParams.set("type", params.filters.type)
  if (params.filters?.hashtag) urlParams.set("hashtag", params.filters.hashtag)
  if (params.filters?.dateFrom) urlParams.set("dateFrom", params.filters.dateFrom)
  if (params.filters?.dateTo) urlParams.set("dateTo", params.filters.dateTo)
  if (params.tab) urlParams.set("tab", params.tab)
  if (params.page && params.page > 1) urlParams.set("page", params.page.toString())
  return `/search?${urlParams.toString()}`
}

export function parseSearchParams(searchParams: URLSearchParams): SearchOptions & { tab: string } {
  return {
    query: searchParams.get("q") || undefined,
    filters: {
      campus: searchParams.get("campus") || undefined,
      programKey: searchParams.get("program") || undefined,
      type: searchParams.get("type") || undefined,
      hashtag: searchParams.get("hashtag") || undefined,
      dateFrom: searchParams.get("dateFrom") || undefined,
      dateTo: searchParams.get("dateTo") || undefined,
    },
    page: parseInt(searchParams.get("page") || "1"),
    tab: searchParams.get("tab") || "posts",
  }
}