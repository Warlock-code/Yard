import { NextRequest, NextResponse } from "next/server"
import { prisma } from "@/lib/prisma"
import { getCurrentUser } from "@/lib/getCurrentUser"

export const dynamic = "force-dynamic"

function parseDateRange(searchParams: URLSearchParams) {
  const range = searchParams.get("range") || "30d"
  const now = new Date()
  let startDate: Date

  switch (range) {
    case "7d":
      startDate = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000)
      break
    case "30d":
      startDate = new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000)
      break
    case "90d":
      startDate = new Date(now.getTime() - 90 * 24 * 60 * 60 * 1000)
      break
    case "all":
      startDate = new Date(0)
      break
    default:
      startDate = new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000)
  }

  const customStart = searchParams.get("start")
  const customEnd = searchParams.get("end")
  if (customStart) startDate = new Date(customStart)
  const endDate = customEnd ? new Date(customEnd) : now

  return { startDate, endDate, range }
}

function getWeekStart(date: Date) {
  const d = new Date(date)
  d.setDate(d.getDate() - d.getDay())
  d.setHours(0, 0, 0, 0)
  return d
}

function getMonthStart(date: Date) {
  const d = new Date(date)
  d.setDate(1)
  d.setHours(0, 0, 0, 0)
  return d
}

export async function GET(req: NextRequest) {
  const user = await getCurrentUser(req)
  if (!user) return NextResponse.json({ error: "Not authenticated." }, { status: 401 })

  if (user.tier !== "PRIME") {
    void prisma.paywallHit.create({ data: { userId: user?.id ?? null, feature: "analytics", pathname: req.nextUrl?.pathname ?? null } }).catch(()=>{})
    return NextResponse.json({ error: "Prime subscription required." }, { status: 403 })
  }

  const { startDate, endDate, range } = parseDateRange(new URL(req.url).searchParams)

  const posts = await prisma.post.findMany({
    where: { userId: user.id, createdAt: { gte: startDate, lte: endDate }, archived: false },
    select: { id: true, createdAt: true, campus: true, program: true },
  })

  const [followers, following, postViews] = await Promise.all([
    prisma.follow.findMany({
      where: { followingId: user.id, createdAt: { gte: startDate, lte: endDate } },
      select: { followerId: true, createdAt: true, follower: { select: { campus: true, program: true } } },
    }),
    prisma.follow.findMany({
      where: { followerId: user.id },
      select: { followingId: true },
    }),
    prisma.postView.findMany({
      where: { postId: { in: posts.map((p) => p.id) } },
      select: { postId: true, userId: true, createdAt: true },
    }),
  ])

  const followerGrowthMap = new Map<string, number>()
  for (const f of followers) {
    const weekStart = getWeekStart(f.createdAt).toISOString().split("T")[0]
    followerGrowthMap.set(weekStart, (followerGrowthMap.get(weekStart) || 0) + 1)
  }
  const followerGrowth = Array.from(followerGrowthMap.entries())
    .sort(([a], [b]) => a.localeCompare(b))
    .map(([week, count]) => ({ week, count }))

  const campusMap = new Map<string, number>()
  const programMap = new Map<string, number>()
  for (const f of followers) {
    campusMap.set(f.follower.campus, (campusMap.get(f.follower.campus) || 0) + 1)
    if (f.follower.program) {
      programMap.set(f.follower.program, (programMap.get(f.follower.program) || 0) + 1)
    }
  }
  const topCampuses = Array.from(campusMap.entries())
    .sort(([, a], [, b]) => b - a)
    .slice(0, 10)
    .map(([campus, count]) => ({ campus, count }))
  const topPrograms = Array.from(programMap.entries())
    .sort(([, a], [, b]) => b - a)
    .slice(0, 10)
    .map(([program, count]) => ({ program, count }))

  const activeHoursMap = new Map<number, number>()
  for (const v of postViews) {
    const hour = new Date(v.createdAt).getHours()
    activeHoursMap.set(hour, (activeHoursMap.get(hour) || 0) + 1)
  }
  const activeHours = Array.from(activeHoursMap.entries())
    .sort(([a], [b]) => a - b)
    .map(([hour, count]) => ({ hour, count }))

  const followerCampuses = followers.map((f) => f.follower.campus)
  const uniqueCampuses = [...new Set(followerCampuses)]

  const totalFollowers = await prisma.follow.count({ where: { followingId: user.id } })
  const totalFollowing = following.length
  const newFollowers = followers.length
  const lostFollowers = await prisma.follow.count({
    where: { followingId: user.id, createdAt: { lt: startDate } },
  })

  return NextResponse.json({
    range,
    summary: {
      totalFollowers,
      totalFollowing,
      newFollowers,
      netGrowth: newFollowers,
      uniqueCampuses: uniqueCampuses.length,
    },
    followerGrowth,
    topCampuses,
    topPrograms,
    activeHours,
  })
}