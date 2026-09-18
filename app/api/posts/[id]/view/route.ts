import { NextRequest, NextResponse } from "next/server"
import { prisma } from "@/lib/prisma"
import { getCurrentUser } from "@/lib/getCurrentUser"

export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const user = await getCurrentUser(req)
  if (!user) return NextResponse.json({ error: "Not authenticated." }, { status: 401 })

  const { id: postId } = await params

  const post = await prisma.post.findUnique({ where: { id: postId } })
  if (!post) return NextResponse.json({ error: "Post not found." }, { status: 404 })

  try {
    await prisma.postView.create({
      data: { postId, userId: user.id },
    })
    return NextResponse.json({ success: true })
  } catch (e: any) {
    if (e.code === "P2002") {
      return NextResponse.json({ success: true, alreadyViewed: true })
    }
    throw e
  }
}