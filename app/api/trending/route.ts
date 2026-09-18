import { NextRequest, NextResponse } from "next/server"
import { getCurrentUser } from "@/lib/getCurrentUser"
import {
  getTrendingHashtags,
  getTrendingPosts,
  getSuggestedGhosts,
  updateTrendingScores,
} from "@/lib/search"

export async function GET(req: NextRequest) {
  const user = await getCurrentUser(req)
  if (!user) return NextResponse.json({ error: "Not authenticated." }, { status: 401 })

  const { searchParams } = new URL(req.url)
  const window = (searchParams.get("window") as "24h" | "7d") || "24h"
  const limit = parseInt(searchParams.get("limit") || "10")
  const type = searchParams.get("type") || "all"

  const [hashtags, posts, suggestedGhosts] = await Promise.all([
    type === "all" || type === "hashtags" ? getTrendingHashtags(user.campus, window, limit) : Promise.resolve([]),
    type === "all" || type === "posts" ? getTrendingPosts(user.campus, window, limit) : Promise.resolve([]),
    type === "all" || type === "ghosts" ? getSuggestedGhosts(user.id, user.campus, 5) : Promise.resolve([]),
  ])

  return NextResponse.json({
    hashtags,
    posts,
    suggestedGhosts,
    window,
  })
}

export async function POST(req: NextRequest) {
  const user = await getCurrentUser(req)
  if (!user || user.tier !== "PRIME") {
    return NextResponse.json({ error: "Admin only." }, { status: 403 })
  }

  const { campus } = await req.json()
  const targetCampus = campus || user.campus

  await updateTrendingScores(targetCampus)

  return NextResponse.json({ success: true })
}