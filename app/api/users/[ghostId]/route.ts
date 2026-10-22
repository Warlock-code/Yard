import { NextRequest, NextResponse } from "next/server"
import type { Prisma } from "@prisma/client"
import { prisma } from "@/lib/prisma"
import { createNotification } from "@/lib/notifications"
import { evalProfileAvatarNudge } from "@/lib/nudges"
import { getCurrentUser } from "@/lib/getCurrentUser"
import { getReadablePostWhere } from "@/lib/programAccess"
import { getChampionTrophies } from "@/lib/champions"
import { recordProfileView } from "@/lib/profileViews"

export async function GET(req: NextRequest, { params }: { params: Promise<{ ghostId: string }> }) {
  const viewer = await getCurrentUser(req)
  if (!viewer) return NextResponse.json({ error: "not authenticated." }, { status: 401 })

  const { ghostId } = await params
  const user = await prisma.user.findUnique({
    where: { ghostId },
    select: { id: true, ghostId: true, avatarEmoji: true, campus: true, tier: true, streakCount: true, referralCount: true },
  })
  if (!user) return NextResponse.json({ error: "ghost not found." }, { status: 404 })

  // Await the ledger and the push so serverless requests do not end before
  // the write/fan-out completes. Both are best-effort and never block the
  // profile response on failure.
  if (viewer.id !== user.id) {
    await recordProfileView(viewer.id, user.id).catch(() => {})

    const sixHoursAgo = new Date(Date.now() - 6 * 60 * 60 * 1000)
    const recentView = await prisma.notification.findFirst({
      where: { userId: user.id, type: "profile_view", actorName: viewer.ghostId, createdAt: { gt: sixHoursAgo } },
      select: { id: true },
    })
    if (!recentView) {
      await createNotification({
        userId: user.id,
        type: "profile_view",
        title: "someone checked your lair",
        body: `${viewer.ghostId} viewed your profile`,
        href: `/u/${viewer.ghostId}`,
        actorName: viewer.ghostId,
      }).catch(() => {})
    }
    // Re-evaluate on every view, including deduped ones — traffic may have
    // crossed the nudge threshold.
    await evalProfileAvatarNudge(user.id).catch(() => {})
  }

  const visiblePosts: Prisma.PostWhereInput = {
    userId: user.id,
    AND: [await getReadablePostWhere(viewer)],
  }
  const cursor = req.nextUrl.searchParams.get("cursor")
  if (cursor) {
    const cursorPost = await prisma.post.findFirst({ where: { AND: [visiblePosts, { id: cursor }] }, select: { id: true } })
    if (!cursorPost) return NextResponse.json({ error: "invalid activity cursor." }, { status: 400 })
  }

  const [postCount, followersCount, followingCount, yeahsAgg, battleVotesAgg, posts, following] = await Promise.all([
    prisma.post.count({ where: visiblePosts }),
    prisma.follow.count({ where: { followingId: user.id } }),
    prisma.follow.count({ where: { followerId: user.id } }),
    prisma.post.aggregate({ where: visiblePosts, _sum: { yeahs: true } }),
    prisma.battleEntry.aggregate({ where: { userId: user.id }, _sum: { votes: true } }),
    prisma.post.findMany({
      where: visiblePosts,
      orderBy: [{ createdAt: "desc" }, { id: "desc" }],
      take: 31,
      ...(cursor ? { cursor: { id: cursor }, skip: 1 } : {}),
      select: { id: true, text: true, imageUrl: true, yeahs: true, commentsCount: true, createdAt: true },
    }),
    prisma.follow.findUnique({
      where: { followerId_followingId: { followerId: viewer.id, followingId: user.id } },
      select: { followerId: true },
    }),
  ])

  // Ghost levels (XP) — free engagement driver. Post/vote/comment/battle
  // activity earns XP; levels unlock avatar grants + perks next to the ghost
  // name. Levels + thresholds live in lib/levels.ts (single source of truth).
  const { xpForActivity, levelForXp } = await import("@/lib/levels")
  const xp = xpForActivity({
    postCount,
    yeahs: yeahsAgg._sum.yeahs || 0,
    battleVotes: battleVotesAgg._sum.votes || 0,
    streakCount: user.streakCount,
    referralCount: user.referralCount,
    followersCount,
  })
  const ghostLevel = levelForXp(xp)

  // Never expose the internal cuid: the response carries only the public
  // ghost identity (ghostId, avatar, tier, campus) plus public social stats.
  const { id: internalId, ...publicUser } = user
  return NextResponse.json({
    user: {
      ...publicUser,
      championTrophies: (await getChampionTrophies([{ id: internalId, campus: user.campus }]).catch(() => new Map<string, number>())).get(internalId) ?? 0,
      isOwn: internalId === viewer.id,
      postCount,
      followersCount,
      followingCount,
      score: (yeahsAgg._sum.yeahs || 0) + (battleVotesAgg._sum.votes || 0),
      isFollowing: !!following,
      xp,
      ghostLevel,
    },
    posts: posts.slice(0, 30),
    nextCursor: posts.length > 30 ? posts[29].id : null,
  }, { headers: { "Cache-Control": "private, no-store" } })
}
