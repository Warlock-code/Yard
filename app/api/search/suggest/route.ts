import { NextRequest, NextResponse } from "next/server"
import { getCurrentUser } from "@/lib/getCurrentUser"
import { prisma } from "@/lib/prisma"

export async function GET(req: NextRequest) {
  const user = await getCurrentUser(req)
  if (!user) return NextResponse.json({ error: "Not authenticated." }, { status: 401 })

  const { searchParams } = new URL(req.url)
  const q = searchParams.get("q")?.trim() || ""
  const campus = searchParams.get("campus") || user.campus

  if (!q || q.length < 2) {
    return NextResponse.json({ suggestions: [] })
  }

  const [hashtags, users, recentSearches] = await Promise.all([
    prisma.hashtag.findMany({
      where: {
        campus,
        tag: { startsWith: q.toLowerCase(), mode: "insensitive" },
      },
      select: { tag: true },
      take: 5,
      orderBy: { trendingScore: "desc" },
    }),
    prisma.user.findMany({
      where: {
        campus,
        ghostId: { startsWith: q, mode: "insensitive" },
        status: "ACTIVE",
      },
      select: { ghostId: true },
      take: 3,
      orderBy: { followers: { _count: "desc" } },
    }),
    prisma.searchHistory.findMany({
      where: {
        userId: user.id,
        query: { startsWith: q, mode: "insensitive" },
      },
      select: { query: true },
      take: 3,
      orderBy: { createdAt: "desc" },
    }),
  ])

  const suggestions = [
    ...hashtags.map((h) => `#${h.tag}`),
    ...users.map((u) => `@${u.ghostId}`),
    ...recentSearches.map((r) => r.query),
  ]

  const unique = [...new Set(suggestions)].slice(0, 8)

  return NextResponse.json({ suggestions: unique })
}