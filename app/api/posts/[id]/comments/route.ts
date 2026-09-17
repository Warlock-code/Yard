import { NextRequest, NextResponse } from "next/server"
import { prisma } from "@/lib/prisma"
import { getCurrentUser } from "@/lib/getCurrentUser"
import { createNotification } from "@/lib/notifications"
import { rateLimit } from "@/lib/rateLimit"


export async function POST(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params
  const user = await getCurrentUser(req)
  if (!user) return NextResponse.json({ error: "Not authenticated." }, { status: 401 })

  const { text, parentId } = await req.json()
  if (!text?.trim()) return NextResponse.json({ error: "Comment can't be empty." }, { status: 400 })
  if (typeof text !== "string" || text.length > 500) {
    return NextResponse.json({ error: "Comment must be 500 characters or fewer." }, { status: 400 })
  }
  if (!rateLimit(`comment:${user.id}`, 20, 60 * 60 * 1000)) {
    return NextResponse.json({ error: "Too many comments. Try again later." }, { status: 429 })
  }

  const comment = await prisma.comment.create({
    data: {
      postId: id,
      userId: user.id,
      ghostId: user.ghostId,
      text,
      parentId: parentId || null,
    },
  })

  await prisma.post.update({
    where: { id },
    data: { commentsCount: { increment: 1 } },
  })

  const post = await prisma.post.findUnique({ where: { id }, include: { user: true } })
if (post && post.userId !== user.id) {
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

  return NextResponse.json({ comment })
}

export async function GET(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params

  const comments = await prisma.comment.findMany({
    where: { postId: id, parentId: null },
    orderBy: { createdAt: "asc" },
    include: {
      replies: {
        orderBy: { createdAt: "asc" },
        include: { replies: true },
      },
    },
  })

  return NextResponse.json({ comments })
}