import { NextRequest, NextResponse } from "next/server"
import { getCurrentUser } from "@/lib/getCurrentUser"
import {
  searchPosts,
  searchUsers,
  searchHashtags,
  searchTop,
  countSearchResults,
  recordSearchHistory,
  sanitizeSearchQuery,
  clampInt,
  SearchFilters,
} from "@/lib/search"

export const dynamic = "force-dynamic"
export const runtime = "nodejs"

const VALID_TABS = new Set(["posts", "people", "hashtags", "top", "media"])
const VALID_SORT = new Set(["relevance", "recent", "engagement"])

function emptyCounts() {
  return { postsTotal: 0, usersTotal: 0, hashtagsTotal: 0 }
}

export async function GET(req: NextRequest) {
  const user = await getCurrentUser(req)
  if (!user) return NextResponse.json({ error: "Not authenticated." }, { status: 401 })

  const { searchParams } = new URL(req.url)

  const rawQuery = searchParams.get("q") ?? ""
  const query = sanitizeSearchQuery(rawQuery, 100)

  const rawTab = (searchParams.get("tab") || "posts").toLowerCase()
  const tab = VALID_TABS.has(rawTab) ? rawTab : "posts"

  const page = clampInt(searchParams.get("page"), 1, 1, 1000)
  const limit = clampInt(searchParams.get("limit"), 20, 1, 50)

  const rawSort = searchParams.get("sortBy") || "relevance"
  const sortBy = (VALID_SORT.has(rawSort) ? rawSort : "relevance") as
    | "relevance"
    | "recent"
    | "engagement"

  const filters: SearchFilters = {
    campus: sanitizeSearchQuery(searchParams.get("campus"), 64) || user.campus,
    programKey: sanitizeSearchQuery(searchParams.get("program"), 64) || undefined,
    type: sanitizeSearchQuery(searchParams.get("type"), 32) || undefined,
    hashtag: sanitizeSearchQuery(searchParams.get("hashtag"), 50) || undefined,
    dateFrom: searchParams.get("dateFrom") || undefined,
    dateTo: searchParams.get("dateTo") || undefined,
  }

  // Empty-q guard: return 200 with empty payload (never 400 for missing q).
  // Only unknown tabs fall through to validation, but we already coerce to "posts".
  if (!query) {
    const counts = emptyCounts()
    if (tab === "people") {
      return NextResponse.json({ users: [], tab, total: 0, page: 1, totalPages: 0, counts })
    }
    if (tab === "hashtags") {
      return NextResponse.json({ hashtags: [], tab, total: 0, page: 1, totalPages: 0, counts })
    }
    if (tab === "top") {
      return NextResponse.json({
        posts: [],
        users: [],
        hashtags: [],
        tab,
        total: 0,
        page: 1,
        totalPages: 0,
        counts,
      })
    }
    // posts + media share post-list shape
    return NextResponse.json({
      posts: [],
      total: 0,
      page: 1,
      totalPages: 0,
      tab,
      sortBy,
      counts,
    })
  }

  try {
    // ---- tab=posts (backward-compat primary) ----
    if (tab === "posts") {
      const [result, counts] = await Promise.all([
        searchPosts({ query, filters, page, limit, sortBy }),
        countSearchResults(query, filters.campus!, filters),
      ])
      // searchPosts.total is authoritative for posts; counts.postsTotal should match
      const mergedCounts = { ...counts, postsTotal: result.total }
      await recordSearchHistory(user.id, query, filters, result.total).catch(() => {})
      return NextResponse.json({ ...result, tab, sortBy, counts: mergedCounts })
    }

    // ---- tab=media: only posts with imageUrl ----
    if (tab === "media") {
      const result = await searchPosts({ query, filters, page, limit, sortBy, mediaOnly: true })
      const counts = await countSearchResults(query, filters.campus!, filters).catch(() => emptyCounts())
      const mergedCounts = { ...counts, postsTotal: result.total }
      await recordSearchHistory(user.id, query, filters, result.total).catch(() => {})
      return NextResponse.json({ ...result, tab, sortBy, counts: mergedCounts })
    }

    // ---- tab=people ----
    if (tab === "people") {
      const [users, counts] = await Promise.all([
        searchUsers(query, filters.campus!, limit),
        countSearchResults(query, filters.campus!, filters).catch(() => emptyCounts()),
      ])
      const total = counts.usersTotal || users.length
      await recordSearchHistory(user.id, query, filters, total).catch(() => {})
      return NextResponse.json({ users, tab, total, page: 1, totalPages: total > limit ? Math.ceil(total / limit) : 1, counts })
    }

    // ---- tab=hashtags ----
    if (tab === "hashtags") {
      const [hashtags, counts] = await Promise.all([
        searchHashtags(query, filters.campus!, limit),
        countSearchResults(query, filters.campus!, filters).catch(() => emptyCounts()),
      ])
      const total = counts.hashtagsTotal || hashtags.length
      await recordSearchHistory(user.id, query, filters, total).catch(() => {})
      return NextResponse.json({ hashtags, tab, total, page: 1, totalPages: 1, counts })
    }

    // ---- tab=top: mixed top posts + users + hashtags ----
    if (tab === "top") {
      const slice = Math.min(limit, 5)
      const [top, counts] = await Promise.all([
        searchTop(query, filters, slice),
        countSearchResults(query, filters.campus!, filters).catch(() => emptyCounts()),
      ])
      const mergedCounts = {
        postsTotal: counts.postsTotal || top.postsTotal,
        usersTotal: counts.usersTotal,
        hashtagsTotal: counts.hashtagsTotal,
      }
      const total = mergedCounts.postsTotal + mergedCounts.usersTotal + mergedCounts.hashtagsTotal
      await recordSearchHistory(user.id, query, filters, total).catch(() => {})
      return NextResponse.json({
        posts: top.posts,
        users: top.users,
        hashtags: top.hashtags,
        tab,
        total,
        page: 1,
        totalPages: mergedCounts.postsTotal > 0 ? Math.ceil(mergedCounts.postsTotal / limit) : 0,
        counts: mergedCounts,
      })
    }

    return NextResponse.json({ error: "Invalid search parameters." }, { status: 400 })
  } catch (err) {
    console.error("GET /api/search failed", err)
    return NextResponse.json({ error: "Search failed." }, { status: 500 })
  }
}
