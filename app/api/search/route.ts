import { NextRequest, NextResponse } from "next/server"
import { getCurrentUser } from "@/lib/getCurrentUser"
import {
  searchPosts,
  searchUsers,
  searchHashtags,
  recordSearchHistory,
  SearchFilters,
} from "@/lib/search"

export async function GET(req: NextRequest) {
  const user = await getCurrentUser(req)
  if (!user) return NextResponse.json({ error: "Not authenticated." }, { status: 401 })

  const { searchParams } = new URL(req.url)
  const query = searchParams.get("q")?.trim() || ""
  const tab = searchParams.get("tab") || "posts"
  const page = parseInt(searchParams.get("page") || "1")
  const limit = parseInt(searchParams.get("limit") || "20")
  const sortBy = (searchParams.get("sortBy") as "relevance" | "recent" | "engagement") || "relevance"

  const filters: SearchFilters = {
    campus: searchParams.get("campus") || user.campus,
    programKey: searchParams.get("program") || undefined,
    type: searchParams.get("type") || undefined,
    hashtag: searchParams.get("hashtag") || undefined,
    dateFrom: searchParams.get("dateFrom") ? new Date(searchParams.get("dateFrom")!).toISOString() : undefined,
    dateTo: searchParams.get("dateTo") ? new Date(searchParams.get("dateTo")!).toISOString() : undefined,
  }

  if (tab === "posts" && query) {
    const result = await searchPosts({ query, filters, page, limit, sortBy })
    await recordSearchHistory(user.id, query, filters, result.total)
    return NextResponse.json({ ...result, tab })
  }

  if (tab === "people" && query) {
    const users = await searchUsers(query, user.campus, limit)
    await recordSearchHistory(user.id, query, filters, users.length)
    return NextResponse.json({ users, tab, total: users.length })
  }

  if (tab === "hashtags" && query) {
    const hashtags = await searchHashtags(query, user.campus, limit)
    await recordSearchHistory(user.id, query, filters, hashtags.length)
    return NextResponse.json({ hashtags, tab, total: hashtags.length })
  }

  return NextResponse.json({ error: "Invalid search parameters." }, { status: 400 })
}