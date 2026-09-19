import { NextRequest, NextResponse } from "next/server"
import { prisma } from "@/lib/prisma"
import { getCurrentUser } from "@/lib/getCurrentUser"
import { createNotification } from "@/lib/notifications"
import { notifyMentions } from "@/lib/mentions"
import { rateLimit } from "@/lib/rateLimit"
import { getReadablePostWhere } from "@/lib/programAccess"
import { emitCommentAdded } from "@/server/socket"


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

  emitCommentAdded(post.campus, comment.postId, {
    postId: comment.postId,
    comment: {
      id: comment.id,
      postId: comment.postId,
      text: comment.text,
      ghostId: comment.ghostId,
      user: {
        ghostId: comment.user.ghostId,
        avatarEmoji: comment.user.avatarEmoji,
      },
      parentId: comment.parentId,
      yeahs: 0,
      createdAt: comment.createdAt.toISOString(),
    },
  })

  return NextResponse.json({ comment: { ...comment, yeahs: 0 } })
}

export async function GET(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params
  const user = await getCurrentUser(req)
  if (!user) return NextResponse.json({ error: "Not authenticated." }, { status: 401 })
  const post = await prisma.post.findFirst({ where: { id, AND: [await getReadablePostWhere(user)] }, select: { id: true } })
  if (!post) return NextResponse.json({ error: "Post not found." }, { status: 404 })

  const sort = new URL(req.url).searchParams.get("sort") === "latest" ? "latest" : "top"

  const all = await prisma.comment.findMany({
    where: { postId: id },
    include: {
      user: { select: { ghostId: true, avatarEmoji: true } },
      votes: { where: { userId: user.id }, select: { id: true } },
    },
  })

  type Node = (typeof all)[number] & { heated: boolean; replies: Node[] }
  const byId = new Map<string, Node>()
  for (const c of all) byId.set(c.id, { ...c, heated: c.votes.length > 0, replies: [] })
  const roots: Node[] = []
  for (const node of byId.values()) {
    if (node.parentId && byId.has(node.parentId)) {
      byId.get(node.parentId)!.replies.push(node)
    } else {
      roots.push(node)
    }
  }

  // X-style weighing: heat matters, but fresh comments still get a shot (HN-style gravity).
  function hotScore(yeahs: number, createdAt: Date) {
    const ageHrs = Math.max(0, (Date.now() - createdAt.getTime()) / 3.6e6)
    return yeahs / Math.pow(ageHrs + 2, 1.2)
  }

  function sortReplies(nodes: Node[]) {
    nodes.sort((a, b) => b.yeahs - a.yeahs || a.createdAt.getTime() - b.createdAt.getTime())
    for (const n of nodes) sortReplies(n.replies)
  }

  if (sort === "latest") {
    roots.sort((a, b) => b.createdAt.getTime() - a.createdAt.getTime())
  } else {
    roots.sort(
      (a, b) => hotScore(b.yeahs, b.createdAt) - hotScore(a.yeahs, a.createdAt)
    )
  }
  for (const r of roots) sortReplies(r.replies)

  const strip = (n: Node): unknown => ({
    id: n.id,
    text: n.text,
    ghostId: n.ghostId,
    yeahs: n.yeahs,
    heated: n.heated,
    createdAt: n.createdAt,
    parentId: n.parentId,
    user: n.user,
    replies: n.replies.map(strip),
  })

  return NextResponse.json({ comments: roots.map(strip), sort })
}