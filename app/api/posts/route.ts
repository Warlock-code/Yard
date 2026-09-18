import { NextRequest, NextResponse } from "next/server"
import type { Prisma } from "@prisma/client"
import { prisma } from "@/lib/prisma"
import { getCurrentUser } from "@/lib/getCurrentUser"
import { notifyMentions } from "@/lib/mentions"
import { rankFeedCandidates } from "@/lib/feedRanking"
import { getProgramPostWhere, getReadablePostWhere } from "@/lib/programAccess"

const POST_COOLDOWN_SECONDS = 30
const MAX_POSTS_PER_HOUR = 10
const FEED_PAGE_SIZE = 20

async function checkImage(imageUrl: string): Promise<boolean> {
  try {
    const res = await fetch("https://openrouter.ai/api/v1/chat/completions", {
      method: "POST",
      headers: { Authorization: `Bearer ${process.env.OPENROUTER_API_KEY}`, "Content-Type": "application/json" },
      body: JSON.stringify({
        model: "anthropic/claude-3.5-haiku",
        messages: [
          {
            role: "user",
            content: [
              { type: "text", text: "Does this image contain nudity, graphic violence, or CSAM? Reply with only one word: SAFE or UNSAFE." },
              { type: "image_url", image_url: { url: imageUrl } },
            ],
          },
        ],
      }),
    })
    const data = await res.json()
    const verdict = data.choices?.[0]?.message?.content?.trim().toUpperCase()
    return verdict !== "UNSAFE"
  } catch {
    return false
  }
}

export async function POST(req: NextRequest) {
  const user = await getCurrentUser(req)
  if (!user) return NextResponse.json({ error: "Not authenticated." }, { status: 401 })

  const { text, imageUrl, type, visibility } = await req.json()

  if (typeof text !== "undefined" && text !== null && (typeof text !== "string" || text.length > 2000)) {
    return NextResponse.json({ error: "Post text must be 2000 characters or fewer." }, { status: 400 })
  }
  if (imageUrl && (typeof imageUrl !== "string" || imageUrl.length > 2048)) {
    return NextResponse.json({ error: "Image URL is invalid." }, { status: 400 })
  }

  if (!text && !imageUrl) {
    return NextResponse.json({ error: "Post needs text or an image." }, { status: 400 })
  }
  if (visibility === "program" && !user.programKey) {
    return NextResponse.json({ error: "Choose your program before posting to Class." }, { status: 400 })
  }

  const recentPost = await prisma.post.findFirst({
    where: { userId: user.id },
    orderBy: { createdAt: "desc" },
  })
  if (recentPost) {
    const secondsSinceLast = (Date.now() - recentPost.createdAt.getTime()) / 1000
    if (secondsSinceLast < POST_COOLDOWN_SECONDS) {
      return NextResponse.json(
        { error: `Slow down — wait ${Math.ceil(POST_COOLDOWN_SECONDS - secondsSinceLast)}s before posting again.` },
        { status: 429 }
      )
    }
  }

  const hourAgo = new Date(Date.now() - 60 * 60 * 1000)
  const postsThisHour = await prisma.post.count({ where: { userId: user.id, createdAt: { gte: hourAgo } } })
  if (postsThisHour >= MAX_POSTS_PER_HOUR) {
    return NextResponse.json({ error: "You've hit the hourly posting limit. Try again later." }, { status: 429 })
  }

  if (imageUrl) {
    const safe = await checkImage(imageUrl)
    if (!safe) {
      return NextResponse.json({ error: "That image can't be posted." }, { status: 400 })
    }
  }

  const upload = imageUrl
    ? await prisma.mediaUpload.findUnique({ where: { url: imageUrl } })
    : null

  if (imageUrl && (!upload || upload.userId !== user.id)) {
    return NextResponse.json({ error: "Image not found in your storage." }, { status: 400 })
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
      isPrime: user.tier === "PRIME",
      visibility: visibility === "program" ? "program" : "school",
    },
  })

  if (upload) {
    await prisma.mediaUpload.update({
      where: { id: upload.id },
      data: { postId: post.id, status: "posted" },
    })
  }

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

  if (text) {
    await notifyMentions({ text, senderUser: user, href: `/post/${post.id}`, excludeUserId: user.id }).catch(() => {})
  }

  return NextResponse.json({ post })
}

export async function GET(req: NextRequest) {
  const user = await getCurrentUser(req)
  if (!user) return NextResponse.json({ error: "Not authenticated." }, { status: 401 })

  const { searchParams } = new URL(req.url)
  const mode = searchParams.get("mode") || "campus"
  const type = searchParams.get("type") || "all"
  const cursor = searchParams.get("cursor")

  const follows = await prisma.follow.findMany({
    where: { followerId: user.id },
    select: { followingId: true },
  })
  const followingIds = new Set(follows.map((follow) => follow.followingId))
  const readableWhere = await getReadablePostWhere(user)
  let scopeWhere: Prisma.PostWhereInput

  if (mode === "campus") {
    scopeWhere = { campus: user.campus, visibility: "school" }
  } else if (mode === "program") {
    scopeWhere = {
      AND: [
        { campus: user.campus, visibility: "program" },
        await getProgramPostWhere(user),
      ],
    }
  } else if (mode === "following") {
    scopeWhere = { userId: { in: [...followingIds] } }
  } else {
    scopeWhere = { campus: { not: user.campus }, visibility: "school" }
  }

  const where: Prisma.PostWhereInput = {
    AND: [readableWhere, scopeWhere, ...(type !== "all" ? [{ type }] : [])],
  }

  const posts = await prisma.post.findMany({
    where,
    orderBy: [{ createdAt: "desc" }, { id: "desc" }],
    include: { user: { select: { id: true, ghostId: true, avatarEmoji: true, tier: true } } },
  })

  const now = new Date()
  const rankedPosts = rankFeedCandidates(posts, {
    campus: user.campus,
    programKey: user.programKey,
    followingIds,
  }, now)
  const activeBoosts = rankedPosts.filter((post) => post.boostedUntil && post.boostedUntil > now)
  const otherPosts = rankedPosts.filter((post) => !post.boostedUntil || post.boostedUntil <= now)
  const orderedPosts = [...activeBoosts, ...otherPosts]

  const cursorIndex = cursor ? orderedPosts.findIndex((post) => post.id === cursor) : -1
  if (cursor && cursorIndex === -1) {
    return NextResponse.json({ error: "Invalid feed cursor." }, { status: 400 })
  }

  const startIndex = cursor ? cursorIndex + 1 : 0
  const page = orderedPosts.slice(startIndex, startIndex + FEED_PAGE_SIZE)
  const nextCursor = startIndex + FEED_PAGE_SIZE < orderedPosts.length
    ? page[page.length - 1]?.id ?? null
    : null

  return NextResponse.json({
    posts: page.map((post) => ({
      ...post,
      boosted: Boolean(post.boostedUntil && post.boostedUntil > now),
      isFollowing: followingIds.has(post.userId),
    })),
    nextCursor,
  })
}
