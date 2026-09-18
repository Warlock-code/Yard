import { NextRequest, NextResponse } from "next/server"
import { getCurrentUser } from "@/lib/getCurrentUser"
import {
  getTrendingHashtags,
  getTrendingPosts,
  getSuggestedGhosts,
  updateTrendingScores,
  normalizeTrendingWindow,
  clampInt,
  sanitizeSearchQuery,
} from "@/lib/search"

export const dynamic = "force-dynamic"
export const runtime = "nodejs"

const VALID_TYPES = new Set(["all", "hashtags", "posts", "ghosts"])

export async function GET(req: NextRequest) {
  const user = await getCurrentUser(req)
  if (!user) return NextResponse.json({ error: "Not authenticated." }, { status: 401 })

  const { searchParams } = new URL(req.url)
  const window = normalizeTrendingWindow(searchParams.get("window"))
  const limit = clampInt(searchParams.get("limit"), 10, 1, 30)
  const rawType = (searchParams.get("type") || "all").toLowerCase()
  const type = VALID_TYPES.has(rawType) ? rawType : "all"

  try {
    const [hashtags, posts, suggestedGhosts] = await Promise.all([
      type === "all" || type === "hashtags"
        ? getTrendingHashtags(user.campus, window, limit)
        : Promise.resolve([]),
      type === "all" || type === "posts"
        ? getTrendingPosts(user.campus, window, limit)
        : Promise.resolve([]),
      type === "all" || type === "ghosts"
        ? getSuggestedGhosts(user.id, user.campus, 5)
        : Promise.resolve([]),
    ])

    return NextResponse.json(
      {
        hashtags,
        posts,
        suggestedGhosts,
        window,
      },
      {
        headers: { "Cache-Control": "private, max-age=60" },
      }
    )
  } catch (err) {
    console.error("GET /api/trending failed", err)
    return NextResponse.json({ error: "Failed to load trending." }, { status: 500 })
  }
}

export async function POST(req: NextRequest) {
  const user = await getCurrentUser(req)
  if (!user || user.tier !== "PRIME") {
    return NextResponse.json({ error: "Admin only." }, { status: 403 })
  }

  let targetCampus = user.campus
  try {
    const body = await req.json()
    const clean = sanitizeSearchQuery(body?.campus, 64)
    if (clean) targetCampus = clean
  } catch {
    // keep default campus when body is empty/invalid
  }

  await updateTrendingScores(targetCampus)

  return NextResponse.json({ success: true })
}
