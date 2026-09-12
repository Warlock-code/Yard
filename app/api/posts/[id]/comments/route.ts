import { NextRequest, NextResponse } from "next/server"
import { prisma } from "@/lib/prisma"
import { getCurrentUser } from "@/lib/getCurrentUser"

// CREATE COMMENT (or reply, if parentId passed)
export async function POST(req: NextRequest, { params }: { params: { id: string } }) {
  const user = await getCurrentUser(req)
  if (!user) return NextResponse.json({ error: "Not authenticated." }, { status: 401 })

  const { text, parentId } = await req.json()
  if (!text?.trim()) return NextResponse.json({ error: "Comment can't be empty." }, { status: 400 })

  const comment = await prisma.comment.create({
    data: {
      postId: params.id,
      userId: user.id,
      ghostId: user.ghostId,
      text,
      parentId: parentId || null,
    },
  })

  await prisma.post.update({
    where: { id: params.id },
    data: { commentsCount: { increment: 1 } },
  })

  return NextResponse.json({ comment })
}

// LIST COMMENTS (threaded — top-level with nested replies)
export async function GET(req: NextRequest, { params }: { params: { id: string } }) {
  const comments = await prisma.comment.findMany({
    where: { postId: params.id, parentId: null },
    orderBy: { createdAt: "asc" },
    include: {
      replies: {
        orderBy: { createdAt: "asc" },
        include: { replies: true }, // one extra level, expand further if needed
      },
    },
  })

  return NextResponse.json({ comments })
}