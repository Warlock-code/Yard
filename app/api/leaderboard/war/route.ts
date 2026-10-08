import { NextRequest, NextResponse } from "next/server"
import { prisma } from "@/lib/prisma"
import { getCurrentUser } from "@/lib/getCurrentUser"

export const dynamic = "force-dynamic"

// Campus war: this week's heat per campus (Monday 00:00 UTC → now).
// Read-only aggregate — no writes, safe to call often.
export async function GET(req: NextRequest) {
  const user = await getCurrentUser(req)
  if (!user) return NextResponse.json({ error: "not authenticated." }, { status: 401 })

  const now = new Date()
  const day = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate()))
  const shift = (day.getUTCDay() + 6) % 7 // days since Monday
  const weekStart = new Date(day.getTime() - shift * 86_400_000)

  const groups = await prisma.post.groupBy({
    by: ["campus"],
    where: { createdAt: { gte: weekStart }, archived: false },
    _count: { _all: true },
    _sum: { yeahs: true, commentsCount: true },
  })

  const campuses = groups
    .map((g) => ({
      campus: g.campus,
      posts: g._count._all,
      yeahs: g._sum.yeahs || 0,
      comments: g._sum.commentsCount || 0,
      score: (g._sum.yeahs || 0) + (g._sum.commentsCount || 0) * 2 + g._count._all,
    }))
    .sort((a, b) => b.score - a.score)

  return NextResponse.json({ campuses, weekStart, myCampus: user.campus })
}
