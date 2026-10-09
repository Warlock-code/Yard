import { NextRequest, NextResponse } from "next/server"
import type { Prisma } from "@prisma/client"
import { prisma } from "@/lib/prisma"
import { getCurrentUser } from "@/lib/getCurrentUser"
import { notifyMentions } from "@/lib/mentions"
import { capAuthorRepetition, rankFeedCandidates } from "@/lib/feedRanking"
import { getProgramPostWhere, getReadablePostWhere } from "@/lib/programAccess"
import { emitNewPost } from "@/lib/socket-client"
import { processPostHashtags } from "@/lib/search"
import { attachChampionTrophies, getChampionTrophies } from "@/lib/champions"
import { textStorageMB } from "@/lib/storage"
import { getEffectiveStorageLimitMB } from "@/lib/tier"

const POST_COOLDOWN_SECONDS = 30
const MAX_POSTS_PER_HOUR = 10
const FEED_PAGE_SIZE = 20

export const dynamic = "force-dynamic"

async function checkImage(imageUrl: string): Promise<boolean> {
  if (!process.env.OPENROUTER_API_KEY) {
    console.warn("image moderation is not configured; allowing the uploaded image")
    return true
  }
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
    if (!res.ok) {
      console.warn(`image moderation request failed with ${res.status}; allowing the uploaded image`)
      return true
    }
    const data = await res.json()
    const verdict = data.choices?.[0]?.message?.content?.trim().toUpperCase()
    return verdict !== "UNSAFE"
  } catch {
    console.warn("image moderation is unavailable; allowing the uploaded image")
    return true
  }
}

export async function POST(req: NextRequest) {
  const user = await getCurrentUser(req)
  if (!user) return NextResponse.json({ error: "not authenticated." }, { status: 401 })

  const { text: rawText, imageUrl, type, visibility } = await req.json()
  const text = typeof rawText === "string" ? rawText.toLowerCase() : rawText
  const textSizeMB = textStorageMB(text)

  if (typeof text !== "undefined" && text !== null && (typeof text !== "string" || text.length > 2000)) {
    return NextResponse.json({ error: "post text must be 2000 characters or fewer." }, { status: 400 })
  }
  if (imageUrl && (typeof imageUrl !== "string" || imageUrl.length > 2048)) {
    return NextResponse.json({ error: "image URL is invalid." }, { status: 400 })
  }

  if (!text && !imageUrl) {
    return NextResponse.json({ error: "post needs text or an image." }, { status: 400 })
  }
  if (user.storageUsed + textSizeMB > getEffectiveStorageLimitMB(user)) {
    return NextResponse.json({ error: "this post would exceed your storage limit." }, { status: 400 })
  }
  if (visibility === "program" && !user.programKey) {
    return NextResponse.json({ error: "choose your program before posting to Class." }, { status: 400 })
  }

  const recentPost = await prisma.post.findFirst({
    where: { userId: user.id },
    orderBy: { createdAt: "desc" },
  })
  if (recentPost) {
    const secondsSinceLast = (Date.now() - recentPost.createdAt.getTime()) / 1000
    if (secondsSinceLast < POST_COOLDOWN_SECONDS) {
      return NextResponse.json(
        { error: `slow down — wait ${Math.ceil(POST_COOLDOWN_SECONDS - secondsSinceLast)}s before posting again.` },
        { status: 429 }
      )
    }
  }

  const hourAgo = new Date(Date.now() - 60 * 60 * 1000)
  const postsThisHour = await prisma.post.count({ where: { userId: user.id, createdAt: { gte: hourAgo } } })
  if (postsThisHour >= MAX_POSTS_PER_HOUR) {
    return NextResponse.json({ error: "you've hit the hourly posting limit. Try again later." }, { status: 429 })
  }

  if (imageUrl) {
    const safe = await checkImage(imageUrl)
    if (!safe) {
      return NextResponse.json({ error: "that image can't be posted." }, { status: 400 })
    }
  }

  const upload = imageUrl
    ? await prisma.mediaUpload.findUnique({ where: { url: imageUrl } })
    : null

  if (imageUrl && (!upload || upload.userId !== user.id)) {
    return NextResponse.json({ error: "image not found in your storage." }, { status: 400 })
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
      cohortYear: user.cohortYear,
      programKey: user.programKey,
      isPrime: false, // Prime tier removed — no post is Prime-flagged anymore
      visibility: visibility === "program" ? "program" : "school",
    },
  })

  if (upload) {
    await prisma.mediaUpload.update({
      where: { id: upload.id },
      data: { postId: post.id, status: "posted" },
    })
  }

  if (textSizeMB > 0) {
    await prisma.user.update({
      where: { id: user.id },
      data: { storageUsed: { increment: textSizeMB } },
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
  if (!user) return NextResponse.json({ error: "not authenticated." }, { status: 401 })

  const { searchParams } = new URL(req.url)
  const mode = searchParams.get("mode") || "campus"
  const type = searchParams.get("type") || "all"
  const cursor = searchParams.get("cursor")
  // Per-refresh shuffle seed from the client. Same seed = same tie order
  // (keeps cursor pagination consistent); new seed = ties rotate.
  const tieSeed = searchParams.get("seed") || undefined

  const [follows, readableWhere, programWhereBase, viewedPosts] = await Promise.all([
    prisma.follow.findMany({ where: { followerId: user.id }, select: { followingId: true } }),
    getReadablePostWhere(user),
    getProgramPostWhere(user),
    prisma.postView.findMany({
      where: { userId: user.id },
      select: { postId: true },
      orderBy: { createdAt: "desc" },
      take: 1000,
    }),
  ])
  const followingIds = new Set(follows.map((follow) => follow.followingId))
  const now = new Date()
  const boostedActiveWhere: Prisma.PostWhereInput = { boostedUntil: { gt: now }, archived: false }
  let scopeWhere: Prisma.PostWhereInput
  let boostedScopeWhere: Prisma.PostWhereInput | null = null

  if (mode === "campus") {
    const programWhere = programWhereBase
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
      AND: [{ campus: user.campus, visibility: "program" }, programWhereBase],
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
  // Admin announcements live outside the ranked feed: they are prepended
  // pinned to the top below, so keep them out of normal ranking/pagination.
  const notAnnouncement: Prisma.PostWhereInput = { type: { not: "announcement" } }
  let where: Prisma.PostWhereInput
  if (boostedScopeWhere) {
    const normalBranch: Prisma.PostWhereInput = {
      AND: [readableWhere, scopeWhere, notAnnouncement, ...(typeWhere ? [typeWhere] : [])],
    }
    const boostedBranch: Prisma.PostWhereInput = {
      AND: [boostedScopeWhere, notAnnouncement, ...(typeWhere ? [typeWhere] : [])],
    }
    where = { OR: [normalBranch, boostedBranch] }
  } else {
    where = { AND: [readableWhere, scopeWhere, notAnnouncement, ...(typeWhere ? [typeWhere] : [])] }
  }

  const viewedPostIds = new Set(viewedPosts.map((v) => v.postId))

  const posts = await prisma.post.findMany({
    where,
    orderBy: [{ createdAt: "desc" }, { id: "desc" }],
    take: 200,
    // tier + tierExpiresAt feed the ranking-only tier boost in
    // rankFeedCandidates (expired tiers count as FREE). No UI effect.
    include: { user: { select: { id: true, ghostId: true, avatarEmoji: true, tier: true, tierExpiresAt: true, campus: true } } },
  })

  // Heating + fresh-love flags for feed badges. Filled during ranking;
  // read when shaping the response. Empty = no badges, never breaks.
  const heatingIds = new Set<string>()
  let lovedId: string | null = null

  const rankedPosts = await (async () => {    // New-creator lift: one batched count per author (best-effort — on
    // failure ranking falls back to no lift, feed still works).
    let authorPostCounts: Map<string, number> | undefined
    try {
      const authorIds = [...new Set(posts.map((p) => p.userId))]
      if (authorIds.length > 0) {
        const counts = await prisma.post.groupBy({
          by: ["userId"],
          where: { userId: { in: authorIds } },
          _count: { _all: true },
        })
        authorPostCounts = new Map(counts.map((c) => [c.userId, c._count._all]))
      }
    } catch {
      authorPostCounts = undefined
    }
    // Reply velocity + report signals: two batched groupBys (best-effort —
    // on failure the new fields stay undefined and ranking falls back to
    // exactly the old formula).
    let recentCommentCounts: Map<string, number> | undefined
    let reportCounts: Map<string, number> | undefined
    try {
      const postIds = posts.map((p) => p.id)
      if (postIds.length > 0) {
        const hourAgo = new Date(now.getTime() - 60 * 60 * 1000)
        const [recent, reports] = await Promise.all([
          prisma.comment.groupBy({
            by: ["postId"],
            where: { postId: { in: postIds }, createdAt: { gte: hourAgo } },
            _count: { _all: true },
          }),
          prisma.report.groupBy({
            by: ["postId"],
            where: { postId: { in: postIds }, status: { not: "dismissed" } },
            _count: { _all: true },
          }),
        ])
        recentCommentCounts = new Map(
          recent.map((r) => [r.postId, r._count._all]).filter((e): e is [string, number] => e[0] !== null)
        )
        for (const [pid, count] of recentCommentCounts) {
          if (count >= 3) heatingIds.add(pid)
        }
        reportCounts = new Map(
          reports.map((r) => [r.postId, r._count._all]).filter((e): e is [string, number] => e[0] !== null)
        )
      }
    } catch {
      recentCommentCounts = undefined
      reportCounts = undefined
    }
    const withSignals = posts.map((p) => ({
      ...p,
      recentCommentsCount: recentCommentCounts?.get(p.id),
      reportsCount: reportCounts?.get(p.id),
    }))
    const ranked = rankFeedCandidates(withSignals, {
      campus: user.campus,
      programKey: user.programKey,
      followingIds,
    }, now, tieSeed, authorPostCounts ? { authorPostCounts } : undefined)
    // Author diversity: max 2 posts per author in the top 20 so one
    // spammer can't own the feed. Deterministic — pagination-safe.
    // Typed back to the plain post rows so everything downstream
    // (unseen split, announcements, pins) is untouched.
    const rankedPosts: typeof posts = capAuthorRepetition(ranked, 2, 20)
    return rankedPosts
  })()

  const unseenPosts = rankedPosts.filter((post) => !viewedPostIds.has(post.id))
  const seenPosts = rankedPosts.filter((post) => viewedPostIds.has(post.id))
  const combinedPosts = [...unseenPosts, ...seenPosts]

  // Needs-love slot: one fresh (<24h), zero-comment campus post gets
  // eyeballs at position 4 so new posts can't die unseen. Skipped on
  // follow-up pages (cursor), in following mode, or when the top already
  // has fresh conversation.
  if (!cursor && mode !== "following") {
    const dayAgo = new Date(now.getTime() - 24 * 60 * 60 * 1000)
    const loved = combinedPosts.findIndex(
      (p) => p.commentsCount === 0 && new Date(p.createdAt) >= dayAgo
    )
    if (loved > 3) {
      const [slot] = combinedPosts.splice(loved, 1)
      combinedPosts.splice(3, 0, slot)
      lovedId = slot.id
    }
  }

  const cursorIndex = cursor ? combinedPosts.findIndex((post) => post.id === cursor) : -1
  if (cursor && cursorIndex === -1) {
    return NextResponse.json({ error: "invalid feed cursor." }, { status: 400 })
  }

  const startIndex = cursor ? cursorIndex + 1 : 0
  const page = combinedPosts.slice(startIndex, startIndex + FEED_PAGE_SIZE)
  const nextCursor = startIndex + FEED_PAGE_SIZE < combinedPosts.length
    ? page[page.length - 1]?.id ?? null
    : null

  // Pinned admin announcements: global ("ALL") or this campus, newest first.
  // Only on the first page, never in following mode (that feed is people only).
  let announcements: typeof page = []
  if (!cursor && mode !== "following") {
    const rows = await prisma.post.findMany({
      where: {
        type: "announcement",
        archived: false,
        OR: [{ campus: "ALL" }, { campus: user.campus }],
      },
      orderBy: [{ createdAt: "desc" }, { id: "desc" }],
      include: { user: { select: { id: true, ghostId: true, avatarEmoji: true, tier: true, tierExpiresAt: true, campus: true } } },
    })
    announcements = rows.map((post) => ({
      ...post,
      boosted: false,
      isFollowing: false,
      seen: false,
    }))
  }

  const fullPage = [
    ...announcements.map((post) => ({ ...post, isFollowing: false, seen: false })),
    ...page.map((post) => ({ ...post, isFollowing: followingIds.has(post.userId), seen: viewedPostIds.has(post.id) })),
  ]

  // Pinned campus spotlight: paid 1hr pins, newest pin first, max 3.
  // Best-effort (empty until the pinnedUntil migration is deployed).
  try {
    if (!cursor) {
      const pinnedRows = await prisma.post.findMany({
        where: { campus: user.campus, archived: false, pinnedUntil: { gt: now } },
        orderBy: [{ pinnedUntil: "desc" }],
        take: 3,
        include: { user: { select: { id: true, ghostId: true, avatarEmoji: true, tier: true, tierExpiresAt: true, campus: true } } },
      })
      const seenIds = new Set(fullPage.map((p) => p.id))
      const freshPins = pinnedRows.filter((p) => !seenIds.has(p.id))
      if (freshPins.length > 0) {
        const withMeta = freshPins.map((post) => ({
          ...post,
          boosted: false,
          isFollowing: followingIds.has(post.userId),
          seen: viewedPostIds.has(post.id),
        }))
        fullPage.unshift(...withMeta)
      }
    }
  } catch {}
  await attachChampionTrophies(fullPage)

  return NextResponse.json({
    posts: fullPage.map((post) => ({
      ...post,
      boosted: Boolean(post.boostedUntil && post.boostedUntil > now),
      pinned: Boolean(post.pinnedUntil && new Date(post.pinnedUntil).getTime() > now.getTime()),
      heating: heatingIds.has(post.id),
      freshLove: lovedId !== null && post.id === lovedId,
    })),
    nextCursor,
  }, { headers: { "Cache-Control": "private, no-store" } })
}
