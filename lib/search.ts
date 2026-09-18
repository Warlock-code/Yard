import { prisma } from "@/lib/prisma"
import { Prisma } from "@prisma/client"

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
}

export async function searchPosts({
  query,
  filters = {},
  page = 1,
  limit = 20,
  sortBy = "relevance",
}: SearchOptions) {
  const where: Prisma.PostWhereInput = {
    archived: false,
    visibility: "school",
  }

  if (filters.campus) {
    where.campus = filters.campus
  }

  if (filters.programKey) {
    where.programKey = filters.programKey
  }

  if (filters.type && filters.type !== "all") {
    where.type = filters.type
  }

  if (filters.dateFrom || filters.dateTo) {
    where.createdAt = {}
    if (filters.dateFrom) where.createdAt.gte = new Date(filters.dateFrom)
    if (filters.dateTo) where.createdAt.lte = new Date(filters.dateTo)
  }

  if (filters.hashtag) {
    where.hashtags = {
      some: {
        hashtag: { tag: filters.hashtag.toLowerCase() },
      },
    }
  }

  if (filters.userId) {
    where.userId = filters.userId
  }

  if (query) {
    where.OR = [
      { text: { contains: query, mode: "insensitive" } },
      { user: { ghostId: { contains: query, mode: "insensitive" } } },
    ]
  }

let orderBy: Prisma.PostOrderByWithRelationInput | Prisma.PostOrderByWithRelationInput[] = {
  createdAt: "desc",
}

if (sortBy === "engagement") {
  orderBy = [
    { yeahs: "desc" },
    { commentsCount: "desc" },
    { createdAt: "desc" },
  ]
} else if (sortBy === "relevance" && query) {
  orderBy = { createdAt: "desc" }
}

  const [posts, total] = await Promise.all([
    prisma.post.findMany({
      where,
      orderBy,
      include: {
        user: { select: { id: true, ghostId: true, avatarEmoji: true, tier: true } },
        hashtags: { include: { hashtag: { select: { tag: true } } } },
      },
      skip: (page - 1) * limit,
      take: limit,
    }),
    prisma.post.count({ where }),
  ])

  return {
    posts,
    total,
    page,
    totalPages: Math.ceil(total / limit),
  }
}

export async function searchUsers(query: string, campus: string, limit = 10) {
  if (!query.trim()) return []

  return prisma.user.findMany({
    where: {
      campus,
      ghostId: { contains: query, mode: "insensitive" },
      status: "ACTIVE",
    },
    select: {
      id: true,
      ghostId: true,
      avatarEmoji: true,
      tier: true,
      _count: { select: { followers: true, posts: true } },
    },
    take: limit,
    orderBy: { followers: { _count: "desc" } },
  })
}

export async function searchHashtags(query: string, campus: string, limit = 10) {
  if (!query.trim()) return []

  return prisma.hashtag.findMany({
    where: {
      campus,
      tag: { contains: query.toLowerCase(), mode: "insensitive" },
    },
    select: {
      id: true,
      tag: true,
      postsCount: true,
      trendingScore: true,
    },
    take: limit,
    orderBy: { trendingScore: "desc" },
  })
}

export async function getTrendingHashtags(campus: string, window: "24h" | "7d" = "24h", limit = 10) {
  const since = new Date()
  if (window === "24h") {
    since.setHours(since.getHours() - 24)
  } else {
    since.setDate(since.getDate() - 7)
  }

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
    orderBy: { trendingScore: "desc" },
    take: limit,
  })

  return hashtags
}

export async function getTrendingPosts(campus: string, window: "24h" | "7d" = "24h", limit = 10) {
  const since = new Date()
  if (window === "24h") {
    since.setHours(since.getHours() - 24)
  } else {
    since.setDate(since.getDate() - 7)
  }

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
    take: limit,
  })

  return posts
}

export async function getSuggestedGhosts(userId: string, campus: string, limit = 5) {
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
    orderBy: { followers: { _count: "desc" } },
    take: limit,
  })
}

export async function recordSearchHistory(
  userId: string,
  query: string,
  filters: SearchFilters,
  resultsCount: number
) {
  await prisma.searchHistory.create({
    data: {
      userId,
      query,
      filters: filters as unknown as Prisma.InputJsonValue,
      resultsCount,
    },
  })
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