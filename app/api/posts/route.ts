import { NextRequest, NextResponse } from "next/server"
import type { Prisma } from "@prisma/client"
import { prisma } from "@/lib/prisma"
import { getCurrentUser } from "@/lib/getCurrentUser"
import { getEffectiveTier } from "@/lib/tier"
import { notifyMentions } from "@/lib/mentions"
import { rankFeedCandidates } from "@/lib/feedRanking"
import { getProgramPostWhere, getReadablePostWhere } from "@/lib/programAccess"
import { emitNewPost } from "@/server/socket"
import { processPostHashtags } from "@/lib/search"
import { attachChampionTrophies, getChampionTrophies } from "@/lib/champions"

const POST_COOLDOWN_SECONDS = 30
const MAX_POSTS_PER_HOUR = 10
const FEED_PAGE_SIZE = 20

export const dynamic = "force-dynamic"

async function checkImage(imageUrl: string): Promise<boolean> {
  if (!process.env.OPENROUTER_API_KEY) return true // moderation disabled — allow
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
    if (!res.ok) return true // fail open — don't block post if moderation down
    const data = await res.json()
    const verdict = data.choices?.[0]?.message?.content?.trim().toUpperCase()
    return verdict !== "UNSAFE"
  } catch {
    return true // network error — allow post, admin can still moderate via reports
  }
}

export async function POST(req: NextRequest) {
  const user = await getCurrentUser(req)
  if (!user) return NextResponse.json({ error: "Not authenticated." }, { status: 401 })

  let { text, imageUrl, type, visibility } = await req.json()
  if (typeof text === "string") text = text.toLowerCase()

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
      isPrime: getEffectiveTier(user) === "PRIME",
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
    await processPostHashtags(post.id, text, user.campus).catch(() => {})
  }

  const postWithUser = await prisma.post.findUnique({
    where: { id: post.id },
    include: { user: { select: { id: true, ghostId: true, avatarEmoji: true, tier: true } } },
  })

  if (postWithUser) {
    const authorTrophies = await getChampionTrophies([{ id: user.id, campus: user.campus }]).catch(() => new Map<string, number>())
    emitNewPost(postWithUser.campus, {
      id: postWithUser.id,
      text: postWithUser.text,
      imageUrl: postWithUser.imageUrl,
      type: postWithUser.type,
      yeahs: postWithUser.yeahs,
      commentsCount: postWithUser.commentsCount,
      boosted: postWithUser.boosted,
      createdAt: postWithUser.createdAt.toISOString(),
      user: {
        id: postWithUser.user.id,
        ghostId: postWithUser.user.ghostId,
        avatarEmoji: postWithUser.user.avatarEmoji,
        tier: postWithUser.user.tier,
        championTrophies: authorTrophies.get(user.id) ?? 0,
      },
      campus: postWithUser.campus,
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
  const cursor = searchParams.get("cursor")
  // Per-refresh shuffle seed from the client. Same seed = same tie order
  // (keeps cursor pagination consistent); new seed = ties rotate.
  const tieSeed = searchParams.get("seed") || undefined

  const follows = await prisma.follow.findMany({
    where: { followerId: user.id },
    select: { followingId: true },
  })
  const followingIds = new Set(follows.map((follow) => follow.followingId))
  const readableWhere = await getReadablePostWhere(user)
  const now = new Date()
  const boostedActiveWhere: Prisma.PostWhereInput = { boostedUntil: { gt: now }, archived: false }
  let scopeWhere: Prisma.PostWhereInput
  let boostedScopeWhere: Prisma.PostWhereInput | null = null

  if (mode === "campus") {
    const programWhere = await getProgramPostWhere(user)
    scopeWhere = {
      OR: [
        { campus: user.campus, visibility: "school" },
        programWhere,
      ],
    }
    // C: boosted bypasses visibility/programKey but stays same-campus for privacy
    boostedScopeWhere = { campus: user.campus, ...boostedActiveWhere }
  } else if (mode === "program") {
    scopeWhere = {
      AND: [{ campus: user.campus, visibility: "program" }, await getProgramPostWhere(user)],
    }
    boostedScopeWhere = null // keep program niche
  } else if (mode === "following") {
    scopeWhere = { userId: { in: [...followingIds] } }
    boostedScopeWhere = null // never inject strangers into following feed
  } else if (mode === "all") {
    scopeWhere = { visibility: "school" }
    // C: boosted in all reaches global (any campus) for max reach
    boostedScopeWhere = { ...boostedActiveWhere }
  } else {
    scopeWhere = { visibility: "school" }
    boostedScopeWhere = { ...boostedActiveWhere }
  }

  const typeWhere = type !== "all" ? { type } : null
  let where: Prisma.PostWhereInput
  if (boostedScopeWhere) {
    const normalBranch: Prisma.PostWhereInput = {
      AND: [readableWhere, scopeWhere, ...(typeWhere ? [typeWhere] : [])],
    }
    const boostedBranch: Prisma.PostWhereInput = {
      AND: [boostedScopeWhere, ...(typeWhere ? [typeWhere] : [])],
    }
    where = { OR: [normalBranch, boostedBranch] }
  } else {
    where = { AND: [readableWhere, scopeWhere, ...(typeWhere ? [typeWhere] : [])] }
  }

  const posts = await prisma.post.findMany({
    where,
    orderBy: [{ createdAt: "desc" }, { id: "desc" }],
    // tier + tierExpiresAt feed the ranking-only tier boost in
    // rankFeedCandidates (expired tiers count as FREE). No UI effect.
    include: { user: { select: { id: true, ghostId: true, avatarEmoji: true, tier: true, tierExpiresAt: true, campus: true } } },
  })

  const rankedPosts = rankFeedCandidates(posts, {
    campus: user.campus,
    programKey: user.programKey,
    followingIds,
  }, now, tieSeed)

  const cursorIndex = cursor ? rankedPosts.findIndex((post) => post.id === cursor) : -1
  if (cursor && cursorIndex === -1) {
    return NextResponse.json({ error: "Invalid feed cursor." }, { status: 400 })
  }

  const startIndex = cursor ? cursorIndex + 1 : 0
  const page = rankedPosts.slice(startIndex, startIndex + FEED_PAGE_SIZE)
  const nextCursor = startIndex + FEED_PAGE_SIZE < rankedPosts.length
    ? page[page.length - 1]?.id ?? null
    : null

  await attachChampionTrophies(page)

  return NextResponse.json({
    posts: page.map((post) => ({
      ...post,
      boosted: Boolean(post.boostedUntil && post.boostedUntil > now),
      isFollowing: followingIds.has(post.userId),
    })),
    nextCursor,
  }, { headers: { "Cache-Control": "private, no-store" } })
}
