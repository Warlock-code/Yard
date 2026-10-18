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
import { getEffectiveStorageLimitMB, getEffectiveTier } from "@/lib/tier"
import { creditUser, CREDIT_CONFIG } from "@/lib/credits"

const POST_COOLDOWN_SECONDS = 30
const MAX_POSTS_PER_HOUR = 10
const FEED_PAGE_SIZE = 20
// Manual native ads: one sponsored slot after every N normal posts.
const AD_SLOT_EVERY = 5
const CAMPUSES = ["University of Ghana", "KNUST", "UCC", "GCTU", "UPSA"]

function weekStartUTC(now = new Date()) {
  const day = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate()))
  const shift = (day.getUTCDay() + 6) % 7
  return new Date(day.getTime() - shift * 86_400_000)
}

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

  const { text: rawText, imageUrl, type, visibility, campusTarget } = await req.json()
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

  // Voice posts cost 100cr to publish (public only — no voice DMs exist).
  if (type === "voice") {
    try {
      await creditUser(user.id, "VOICE_POST", -CREDIT_CONFIG.SPEND.VOICE_POST, `voice_${user.id}_${Date.now()}`, {})
    } catch (err) {
      const { toCreditErrorResponse } = await import("@/lib/credits")
      return toCreditErrorResponse(err, "voice posts cost 100cr.")
    }
  }

  // Cross-campus posting: another campus 500cr, all campuses 2,000cr.
  // PRIME gets 3 free cross-posts/week. Anonymous throughout — the ghost
  // name travels, never the identity behind it.
  let targetCampuses = [user.campus]
  if (typeof campusTarget === "string" && campusTarget.length > 0) {
    if (campusTarget === "all") {
      targetCampuses = [...CAMPUSES]
    } else if (campusTarget !== user.campus) {
      if (!CAMPUSES.includes(campusTarget)) {
        return NextResponse.json({ error: "unknown campus." }, { status: 400 })
      }
      targetCampuses = [campusTarget]
    }
  }
  const isCrossPost = targetCampuses.length > 1 || targetCampuses[0] !== user.campus
  if (isCrossPost) {
    const { toCreditErrorResponse } = await import("@/lib/credits")
    const allCampuses = targetCampuses.length > 1
    let useFree = false
    if (getEffectiveTier(user) === "PRIME") {
      try {
        const used = await prisma.creditTransaction.count({
          where: {
            userId: user.id,
            type: { in: ["XCAMPUS_POST", "XCAMPUS_FREE"] },
            createdAt: { gte: weekStartUTC() },
          },
        })
        useFree = used < 3
      } catch {
        useFree = false
      }
    }
    if (useFree) {
      await prisma.creditTransaction
        .create({
          data: {
            userId: user.id,
            type: "XCAMPUS_FREE",
            amount: 0,
            balanceAfter: user.creditsBalance,
            reference: `xcampus_${user.id}_${Date.now()}`,
            metadata: { targets: targetCampuses } as Prisma.InputJsonValue,
          },
        })
        .catch(() => null)
    } else {
      const fee = allCampuses ? CREDIT_CONFIG.SPEND.ALLCAMPUS_POST : CREDIT_CONFIG.SPEND.XCAMPUS_POST
      try {
        await creditUser(user.id, "XCAMPUS_POST", -fee, `xcampus_${user.id}_${Date.now()}`, {
          targets: targetCampuses,
        })
      } catch (err) {
        return toCreditErrorResponse(err, "cross-campus posts need credits.")
      }
    }
  }

  const { trackFeatureEvent } = await import("@/lib/credits")
  if (isCrossPost) {
    await trackFeatureEvent({
      userId: user.id,
      type: "xpost",
      metadata: { targets: targetCampuses },
    })
  }

  const createdPosts = []
  for (const campus of targetCampuses) {
    createdPosts.push(
      await prisma.post.create({
        data: {
          userId: user.id,
          text,
          imageUrl,
          type: type || "confession",
          campus,
          program: user.program,
          programLevel: user.programLevel,
          cohortYear: user.cohortYear,
          programKey: user.programKey,
          isPrime: false,
          visibility: visibility === "program" ? "program" : "school",
        },
      })
    )
  }
  const post = createdPosts[0]

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
    const newStreak = postedYesterday || frozen ? user.streakCount + 1 : 1

    await prisma.user.update({
      where: { id: user.id },
      data: {
        lastPostedAt: new Date(),
        streakCount: newStreak,
        ...(streakBroke && { lastStreakCount: user.streakCount, streakBrokenAt: new Date() }),
      },
    })

    // Streak milestones: 7d → 100cr (PLUS) / 200cr (PRIME), 30d → 500/1000.
    // Streak-multiplier purchases stack on top. FREE earns 0 (shadow only).
    if (newStreak === 7 || newStreak === 30) {
      const base = newStreak === 7 ? CREDIT_CONFIG.EARN.STREAK_7D : CREDIT_CONFIG.EARN.STREAK_30D
      const mult = CREDIT_CONFIG.TIER_MULTIPLIER[getEffectiveTier(user) as keyof typeof CREDIT_CONFIG.TIER_MULTIPLIER]?.earn ?? 0
      const { activeStreakMult } = await import("@/lib/credits")
      const smult = await activeStreakMult(user.id).catch(() => 1)
      const reward = Math.round(base * mult * smult)
      if (reward > 0) {
        await creditUser(user.id, "STREAK", reward, `streak_${newStreak}d`, {
          streak: newStreak,
          tier: getEffectiveTier(user),
        }).catch(() => {})
      } else {
        const shadow = Math.round(base * 1)
        if (shadow > 0) {
          const { logMissedEarnings } = await import("@/lib/missedEarnings")
          await logMissedEarnings(user.id, shadow, { source: "streak", streak: newStreak }).catch(() => {})
        }
      }
    }
  }

  if (text) {
    await notifyMentions({ text, senderUser: user, href: `/post/${post.id}`, excludeUserId: user.id }).catch(() => {})
    for (const p of createdPosts) {
      await processPostHashtags(p.id, text, p.campus).catch(() => {})
    }
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

  return NextResponse.json({ post, posts: createdPosts })
}

export async function GET(req: NextRequest) {
  const user = await getCurrentUser(req)
  // Guest browsing: logged-out visitors get a read-only global feed
  // (school-visibility posts only). Campus/class/following modes need
  // an identity, so guests are locked to "all".
  const guest = !user
  const viewerCampus = user?.campus ?? ""
  const viewerProgramKey = user?.programKey ?? null

  const { searchParams } = new URL(req.url)
  const requestedMode = searchParams.get("mode") || "campus"
  const mode = guest ? "all" : requestedMode
  const type = searchParams.get("type") || "all"
  const cursor = searchParams.get("cursor")
  // Per-refresh shuffle seed from the client. Same seed = same tie order
  // (keeps cursor pagination consistent); new seed = ties rotate.
  const tieSeed = searchParams.get("seed") || undefined

  const [follows, readableWhere, programWhereBase, viewedPosts] = !user
    ? [
        [] as { followingId: string }[],
        { archived: false, visibility: "school" } as Prisma.PostWhereInput,
        { id: { in: [] } } as Prisma.PostWhereInput,
        [] as { postId: string }[],
      ]
    : await Promise.all([
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
        { campus: viewerCampus, visibility: "school" },
        programWhere,
      ],
    }
    // C: boosted bypasses visibility/programKey but stays same-campus for privacy
    boostedScopeWhere = { campus: viewerCampus, ...boostedActiveWhere }
  } else if (mode === "program") {
    scopeWhere = {
      AND: [{ campus: viewerCampus, visibility: "program" }, programWhereBase],
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
  // Manual ads also live outside ranking: they are woven into the page below
  // (one every AD_SLOT_EVERY normal posts), never ranked as candidates.
  const notAd: Prisma.PostWhereInput = { isAd: false }
  let where: Prisma.PostWhereInput
  if (boostedScopeWhere) {
    const normalBranch: Prisma.PostWhereInput = {
      AND: [readableWhere, scopeWhere, notAnnouncement, notAd, ...(typeWhere ? [typeWhere] : [])],
    }
    const boostedBranch: Prisma.PostWhereInput = {
      AND: [boostedScopeWhere, notAnnouncement, notAd, ...(typeWhere ? [typeWhere] : [])],
    }
    where = { OR: [normalBranch, boostedBranch] }
  } else {
    where = { AND: [readableWhere, scopeWhere, notAnnouncement, notAd, ...(typeWhere ? [typeWhere] : [])] }
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
      campus: viewerCampus,
      programKey: viewerProgramKey,
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

  // Manual native ads ("Yard Sponsor" placements): fetched separately and
  // woven into the response page — 1 ad after every AD_SLOT_EVERY normal
  // posts, rotating round-robin so multiple ads spread out evenly instead of
  // clumping. Slot positions are global (startIndex-based) so every page
  // continues the rotation and paging never repeats an ad back-to-back. The
  // ads are added after pagination so cursors still point at normal posts.
  // Best-effort: a pre-migration database simply yields no ads.
  let pageWithAds: typeof page = page
  try {
    const ads = await prisma.post.findMany({
      where: { isAd: true, archived: false },
      orderBy: [{ createdAt: "desc" }, { id: "desc" }],
      take: 20,
      include: { user: { select: { id: true, ghostId: true, avatarEmoji: true, tier: true, tierExpiresAt: true, campus: true } } },
    })
    if (ads.length > 0) {
      const woven: typeof page = []
      let slot = Math.floor(startIndex / AD_SLOT_EVERY)
      page.forEach((post, i) => {
        woven.push(post)
        if ((i + 1) % AD_SLOT_EVERY === 0) {
          woven.push(ads[slot % ads.length])
          slot += 1
        }
      })
      pageWithAds = woven
    }
  } catch {}

  // Pinned admin announcements: global ("ALL") or this campus, newest first.
  // Only on the first page, never in following mode (that feed is people only).
  // Guests only ever see global announcements — campus ones need a campus.
  let announcements: typeof page = []
  if (!cursor && mode !== "following") {
    const rows = await prisma.post.findMany({
      where: {
        type: "announcement",
        archived: false,
        OR: guest ? [{ campus: "ALL" }] : [{ campus: "ALL" }, { campus: viewerCampus }],
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
    ...pageWithAds.map((post) => ({ ...post, isFollowing: followingIds.has(post.userId), seen: viewedPostIds.has(post.id) })),
  ]

  // Pinned campus spotlight: paid 1hr pins, newest pin first, max 3.
  // Best-effort (empty until the pinnedUntil migration is deployed).
  // Skipped for guests — pins are campus-scoped and guests have no campus.
  try {
    if (!cursor && !guest) {
      const pinnedRows = await prisma.post.findMany({
        where: { campus: viewerCampus, archived: false, pinnedUntil: { gt: now } },
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
  // Confession of the day: the live COTD post (isCOTD + cotdDate < 24h)
  // leads the first page with a cotd flag for its distinct card. Deduped
  // against announcements/pins/page rows. Live-safe pre-migration.
  let cotdId: string | null = null
  try {
    if (!cursor) {
      const cotdCutoff = new Date(now.getTime() - 24 * 60 * 60 * 1000)
      const cotdRows = await prisma.post.findMany({
        where: { isCOTD: true, cotdDate: { gt: cotdCutoff }, archived: false },
        orderBy: [{ cotdDate: "desc" }],
        take: 1,
        include: { user: { select: { id: true, ghostId: true, avatarEmoji: true, tier: true, tierExpiresAt: true, campus: true } } },
      })
      const seenIds = new Set(fullPage.map((p) => p.id))
      const freshCotd = cotdRows.filter((p) => !seenIds.has(p.id))
      if (freshCotd.length > 0) {
        cotdId = freshCotd[0].id
        const withMeta = freshCotd.map((post) => ({
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
      cotd: cotdId !== null && post.id === cotdId,
    })),
    nextCursor,
  }, { headers: { "Cache-Control": "private, no-store" } })
}
