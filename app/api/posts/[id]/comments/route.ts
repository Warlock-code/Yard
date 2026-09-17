import { NextRequest, NextResponse } from "next/server"
import { prisma } from "@/lib/prisma"
import { getCurrentUser } from "@/lib/getCurrentUser"
import { createNotification } from "@/lib/notifications"
import { notifyMentions } from "@/lib/mentions"
import { rateLimit } from "@/lib/rateLimit"
import { getReadablePostWhere } from "@/lib/programAccess"


export async function POST(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params
  const user = await getCurrentUser(req)
  if (!user) return NextResponse.json({ error: "Not authenticated." }, { status: 401 })

  const post = await prisma.post.findFirst({
    where: { id, AND: [await getReadablePostWhere(user)] },
    include: { user: true },
  })
  if (!post) return NextResponse.json({ error: "Post not found." }, { status: 404 })

  const { text, parentId } = await req.json()
  if (typeof text !== "string" || !text.trim()) return NextResponse.json({ error: "Comment can't be empty." }, { status: 400 })
  if (typeof text !== "string" || text.length > 500) {
    return NextResponse.json({ error: "Comment must be 500 characters or fewer." }, { status: 400 })
  }
  if (!rateLimit(`comment:${user.id}`, 20, 60 * 60 * 1000)) {
    return NextResponse.json({ error: "Too many comments. Try again later." }, { status: 429 })
  }

  if (parentId) {
    if (typeof parentId !== "string") return NextResponse.json({ error: "Invalid reply." }, { status: 400 })
    const parent = await prisma.comment.findFirst({ where: { id: parentId, postId: id }, select: { id: true } })
    if (!parent) return NextResponse.json({ error: "Comment not found." }, { status: 404 })
  }

  const comment = await prisma.comment.create({
    data: {
      postId: id,
      userId: user.id,
      ghostId: user.ghostId,
      text,
      parentId: parentId || null,
    },
    include: { user: { select: { ghostId: true, avatarEmoji: true } } },
  })

  await prisma.post.update({
    where: { id },
    data: { commentsCount: { increment: 1 } },
  })

  if (post) {
    if (post.userId !== user.id) {
      await createNotification({
        userId: post.userId,
        pushToken: post.user.pushToken,
        type: "comment",
        title: "New comment",
        body: `${user.ghostId} replied to your post`,
        href: `/post/${post.id}`,
        actorName: user.ghostId,
      })
    }

    if (parentId) {
      const parentComment = await prisma.comment.findUnique({
        where: { id: parentId },
        select: { userId: true, user: { select: { pushToken: true } } },
      })
      if (
        parentComment &&
        parentComment.userId !== post.userId &&
        parentComment.userId !== user.id
      ) {
        await createNotification({
          userId: parentComment.userId,
          pushToken: parentComment.user.pushToken,
          type: "reply",
          title: "New reply",
          body: `${user.ghostId} replied to your comment`,
          href: `/post/${id}`,
          actorName: user.ghostId,
        })
      }
    }
  }

  await notifyMentions({ text, senderUser: user, href: `/post/${post?.id ?? id}`, excludeUserId: user.id }).catch(() => {})

  return NextResponse.json({ comment })
}

export async function GET(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params
  const user = await getCurrentUser(req)
  if (!user) return NextResponse.json({ error: "Not authenticated." }, { status: 401 })
  const post = await prisma.post.findFirst({ where: { id, AND: [await getReadablePostWhere(user)] }, select: { id: true } })
  if (!post) return NextResponse.json({ error: "Post not found." }, { status: 404 })

  const comments = await prisma.comment.findMany({
    where: { postId: id, parentId: null },
    orderBy: { createdAt: "asc" },
    include: {
      user: { select: { ghostId: true, avatarEmoji: true } },
      replies: {
        orderBy: { createdAt: "asc" },
        include: {
          user: { select: { ghostId: true, avatarEmoji: true } },
          replies: {
            include: { user: { select: { ghostId: true, avatarEmoji: true } } },
          },
        },
      },
    },
  })

  return NextResponse.json({ comments })
}