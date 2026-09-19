import { NextRequest, NextResponse } from "next/server"
import { prisma } from "@/lib/prisma"
import { getCurrentUser } from "@/lib/getCurrentUser"
import { createNotification } from "@/lib/notifications"
import { getReadablePostWhere } from "@/lib/programAccess"
import { emitCommentVote } from "@/server/socket"

export async function POST(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params
  const user = await getCurrentUser(req)
  if (!user) return NextResponse.json({ error: "Not authenticated." }, { status: 401 })

  const comment = await prisma.comment.findUnique({
    where: { id },
    include: { post: true, user: { select: { pushToken: true } } },
  })
  if (!comment) return NextResponse.json({ error: "Comment not found." }, { status: 404 })

  const readable = await prisma.post.findFirst({
    where: { id: comment.postId, AND: [await getReadablePostWhere(user)] },
    select: { id: true },
  })
  if (!readable) return NextResponse.json({ error: "Comment not found." }, { status: 404 })

  try {
    await prisma.commentVote.create({ data: { commentId: id, userId: user.id } })
  } catch (err: unknown) {
    if (typeof err === "object" && err !== null && "code" in err && err.code === "P2002") {
      return NextResponse.json({ error: "You already heated this comment." }, { status: 400 })
    }
    throw err
  }

  const updated = await prisma.comment.update({
    where: { id },
    data: { yeahs: { increment: 1 } },
    select: { id: true, postId: true, yeahs: true, userId: true },
  })

  if (updated.userId !== user.id) {
    await createNotification({
      userId: updated.userId,
      pushToken: comment.user.pushToken,
      type: "comment_like",
      title: "Your comment got heat",
      body: `${user.ghostId} heated your comment`,
      href: `/post/${updated.postId}`,
      actorName: user.ghostId,
    }).catch(() => {})
  }

  emitCommentVote(comment.post.campus, updated.postId, updated.id, updated.yeahs)

  return NextResponse.json({ comment: updated })
}
