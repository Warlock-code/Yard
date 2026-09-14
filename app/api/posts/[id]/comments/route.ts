import { NextRequest, NextResponse } from "next/server"
import { prisma } from "@/lib/prisma"
import { getCurrentUser } from "@/lib/getCurrentUser"
import { sendPush } from "@/lib/sendPush"


export async function POST(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params
  const user = await getCurrentUser(req)
  if (!user) return NextResponse.json({ error: "Not authenticated." }, { status: 401 })

  const { text, parentId } = await req.json()
  if (!text?.trim()) return NextResponse.json({ error: "Comment can't be empty." }, { status: 400 })

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
if (post && post.user.pushToken && post.userId !== user.id) {
  await sendPush(post.user.pushToken, "New comment", "Someone replied to your post")
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