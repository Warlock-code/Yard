import { NextRequest, NextResponse } from "next/server"
import { prisma } from "@/lib/prisma"
import { getCurrentUser } from "@/lib/getCurrentUser"

export async function POST(req: NextRequest) {
  const user = await getCurrentUser(req)
  if (!user) return NextResponse.json({ error: "Not authenticated." }, { status: 401 })

  const { text, imageUrl, type, pollOptions, visibility } = await req.json()

  if (!text && !imageUrl) {
    return NextResponse.json({ error: "Post needs text or an image." }, { status: 400 })
  }

  const post = await prisma.post.create({
    data: {
      userId: user.id,
      text,
      imageUrl,
      type: type || "confession",
      campus: user.campus,
      program: user.program,
      programLevel: user.programLevel,
      programKey: user.programKey,
      pollOptions: pollOptions || [],
      isPrime: user.tier === "PRIME",
      visibility: visibility === "program" ? "program" : "school",
    },
  })

  const today = new Date()
  today.setHours(0, 0, 0, 0)
  const lastPosted = user.lastPostedAt ? new Date(user.lastPostedAt) : null
  if (lastPosted) lastPosted.setHours(0, 0, 0, 0)

  const alreadyPostedToday = lastPosted && lastPosted.getTime() === today.getTime()

  if (!alreadyPostedToday) {
    const yesterday = new Date(today)
    yesterday.setDate(yesterday.getDate() - 1)
    const postedYesterday = lastPosted && lastPosted.getTime() === yesterday.getTime()
    const frozen = user.streakFreezeUntil && new Date(user.streakFreezeUntil) > new Date()
    const streakBroke = !postedYesterday && !frozen && user.streakCount > 0

    await prisma.user.update({
      where: { id: user.id },
      data: {
        lastPostedAt: new Date(),
        streakCount: postedYesterday || frozen ? user.streakCount + 1 : 1,
        ...(streakBroke && { lastStreakCount: user.streakCount, streakBrokenAt: new Date() }),
      },
    })
  }

  return NextResponse.json({ post })
}

export async function GET(req: NextRequest) {
  const user = await getCurrentUser(req)
  if (!user) return NextResponse.json({ error: "Not authenticated." }, { status: 401 })

  const { searchParams } = new URL(req.url)
  const mode = searchParams.get("mode") || "campus"
  const type = searchParams.get("type") || "all"

  const where: any = { archived: false }

  if (mode === "campus") {
    where.campus = user.campus
    where.visibility = "school"
  } else if (mode === "program") {
    where.campus = user.campus
    where.programKey = user.programKey
  } else if (mode === "following") {
    const follows = await prisma.follow.findMany({ where: { followerId: user.id } })
    where.userId = { in: follows.map((f) => f.followingId) }
  } else if (mode === "all") {
    where.visibility = "school"
  }

  if (type !== "all") where.type = type

  const posts = await prisma.post.findMany({
    where,
    orderBy: { createdAt: "desc" },
    take: 50,
    include: { user: { select: { id: true, ghostId: true, avatarEmoji: true, tier: true } } },
  })

  const now = new Date()
  const sorted = [...posts].sort((a, b) => {
    const aBoost = a.boostedUntil && a.boostedUntil > now
    const bBoost = b.boostedUntil && b.boostedUntil > now
    if (aBoost && !bBoost) return -1
    if (bBoost && !aBoost) return 1
    return 0
  })

  return NextResponse.json({ posts: sorted })
}