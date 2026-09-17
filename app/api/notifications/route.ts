import { NextRequest, NextResponse } from "next/server"
import { getCurrentUser } from "@/lib/getCurrentUser"
import { prisma } from "@/lib/prisma"
import { getReadablePostWhere } from "@/lib/programAccess"
import type { Prisma } from "@prisma/client"

const iconByType: Record<string, string> = {
  mention: "\u{1F4AC}",
  comment: "\u{1F4AC}",
  reply: "\u{1F4AC}",
  like: "\u{1F525}",
  vote_milestone: "\u{1F680}",
  profile_view: "\u{1F440}",
  follow: "\u{2795}",
  return_reminder: "\u{1F47B}",
  nudge: "\u{2728}",
}

const defaultIcon = "\u{1F514}"

export async function GET(req: NextRequest) {
  const user = await getCurrentUser(req)
  if (!user) return NextResponse.json({ error: "Not authenticated." }, { status: 401 })

  const requestedLimit = Number(req.nextUrl.searchParams.get("limit") || 30)
  const limit = Number.isFinite(requestedLimit) && requestedLimit > 0 ? Math.min(requestedLimit, 50) : 30
  const postLinks = await prisma.notification.findMany({
    where: { userId: user.id, href: { startsWith: "/post/" } },
    select: { href: true },
    distinct: ["href"],
  })
  const postIdFromHref = (href: string) => href.slice("/post/".length).split(/[?#]/u)[0]
  const readablePosts = postLinks.length ? await prisma.post.findMany({
    where: { id: { in: postLinks.map(({ href }) => postIdFromHref(href)) }, AND: [await getReadablePostWhere(user)] },
    select: { id: true },
  }) : []
  const readableIds = new Set(readablePosts.map(({ id }) => id))
  const hiddenLinks = postLinks.filter(({ href }) => !readableIds.has(postIdFromHref(href))).map(({ href }) => href)
  const visibleNotifications: Prisma.NotificationWhereInput = {
    userId: user.id,
    ...(hiddenLinks.length ? { href: { notIn: hiddenLinks } } : {}),
  }
  const fetched = await prisma.notification.findMany({
    where: visibleNotifications,
    orderBy: { createdAt: "desc" },
    take: limit,
  })
  const unreadCount = await prisma.notification.count({ where: { userId: user.id, readAt: null } })

  const enriched = fetched.map((notification) => ({
    ...notification,
    icon: Object.prototype.hasOwnProperty.call(iconByType, notification.type)
      ? iconByType[notification.type]
      : defaultIcon,
  }))

  const now = new Date()
  const mostRecent = fetched[0]
  const shouldNudge =
    unreadCount === 0 && mostRecent !== undefined && now.getTime() - mostRecent.createdAt.getTime() > 24 * 60 * 60 * 1000
  const notifications = shouldNudge
    ? [{
        id: "nudge_new_posts",
        type: "nudge",
        title: "Check back",
        body: "There are more posts waiting in the yard.",
        href: "/feed",
        readAt: now.toISOString(),
        createdAt: now.toISOString(),
        actorName: null,
        icon: iconByType.nudge,
      }, ...enriched]
    : enriched

  return NextResponse.json({ notifications, unreadCount })
}

export async function PATCH(req: NextRequest) {
  const user = await getCurrentUser(req)
  if (!user) return NextResponse.json({ error: "Not authenticated." }, { status: 401 })

  const body = await req.json().catch(() => ({}))
  if (body.all === true) {
    await prisma.notification.updateMany({
      where: { userId: user.id, readAt: null },
      data: { readAt: new Date() },
    })
  } else if (typeof body.id === "string") {
    await prisma.notification.updateMany({
      where: { id: body.id, userId: user.id },
      data: { readAt: new Date() },
    })
  } else {
    return NextResponse.json({ error: "Notification id or all is required." }, { status: 400 })
  }

  return NextResponse.json({ success: true })
}