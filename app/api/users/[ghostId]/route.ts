import { NextRequest, NextResponse } from "next/server"
import type { Prisma } from "@prisma/client"
import { prisma } from "@/lib/prisma"
import { createNotification } from "@/lib/notifications"
import { evalProfileAvatarNudge } from "@/lib/nudges"
import { getCurrentUser } from "@/lib/getCurrentUser"
import { getReadablePostWhere } from "@/lib/programAccess"
import { getChampionTrophies } from "@/lib/champions"

export async function GET(req: NextRequest, { params }: { params: Promise<{ ghostId: string }> }) {
  const viewer = await getCurrentUser(req)
  if (!viewer) return NextResponse.json({ error: "not authenticated." }, { status: 401 })

  const { ghostId } = await params
  const user = await prisma.user.findUnique({
    where: { ghostId },
    select: { id: true, ghostId: true, avatarEmoji: true, campus: true, tier: true, streakCount: true, referralCount: true },
  })
  if (!user) return NextResponse.json({ error: "ghost not found." }, { status: 404 })

  // Who-viewed ledger (PLUS/PRIME read it via /api/profile/views).
  if (viewer.id !== user.id) {
    import("@/lib/profileViews")
      .then((m) => m.recordProfileView(viewer.id, user.id))
      .catch(() => {})
  }

  if (viewer.id !== user.id) {
    const sixHoursAgo = new Date(Date.now() - 6 * 60 * 60 * 1000)
    const recentView = await prisma.notification.findFirst({
      where: { userId: user.id, type: "profile_view", actorName: viewer.ghostId, createdAt: { gt: sixHoursAgo } },
      select: { id: true },
    })
    if (!recentView) {
      createNotification({
        userId: user.id,
        type: "profile_view",
        title: "someone checked your lair",
        body: `${viewer.ghostId} viewed your profile`,
        href: `/u/${viewer.ghostId}`,
        actorName: viewer.ghostId,
      }).then(() => {
        // Smart nudge: profile getting views + default avatar -> upsell avatar (fire-and-forget)
        evalProfileAvatarNudge(user.id).catch(() => {})
      }).catch(() => {})
    } else {
      // Even on deduped views, re-evaluate — traffic may have crossed threshold
      evalProfileAvatarNudge(user.id).catch(() => {})
    }
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
  // activity earns XP; levels unlock bragging rights next to the ghost name.
  const xp =
    postCount * 10 +
    (yeahsAgg._sum.yeahs || 0) * 2 +
    (battleVotesAgg._sum.votes || 0) * 3 +
    user.streakCount * 5 +
    user.referralCount * 20 +
    followersCount
  const LEVELS = [
    { level: 1, xp: 0, title: "hatchling", emoji: "👻" },
    { level: 2, xp: 100, title: "lurker", emoji: "🌙" },
    { level: 3, xp: 300, title: "sparker", emoji: "🔥" },
    { level: 4, xp: 600, title: "battler", emoji: "⚔️" },
    { level: 5, xp: 1000, title: "haunter", emoji: "💀" },
    { level: 6, xp: 2000, title: "legend", emoji: "👑" },
  ]
  const ghostLevel = [...LEVELS].reverse().find((l) => xp >= l.xp) ?? LEVELS[0]

  return NextResponse.json({
    user: {
      ...user,
      championTrophies: (await getChampionTrophies([{ id: user.id, campus: user.campus }]).catch(() => new Map<string, number>())).get(user.id) ?? 0,
      isOwn: user.id === viewer.id,
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
