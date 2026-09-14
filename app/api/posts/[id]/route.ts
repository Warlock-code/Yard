import { NextRequest, NextResponse } from "next/server"
import { prisma } from "@/lib/prisma"
import { getCurrentUser } from "@/lib/getCurrentUser"

export async function DELETE(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params
  const user = await getCurrentUser(req)
  if (!user) return NextResponse.json({ error: "Not authenticated." }, { status: 401 })

  const post = await prisma.post.findUnique({ where: { id } })
  if (!post) return NextResponse.json({ error: "Post not found." }, { status: 404 })
  if (post.userId !== user.id) return NextResponse.json({ error: "Not your post." }, { status: 403 })

  await prisma.post.delete({ where: { id } })
  return NextResponse.json({ success: true })
}

export async function PATCH(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params
  const user = await getCurrentUser(req)
  if (!user) return NextResponse.json({ error: "Not authenticated." }, { status: 401 })

  if (user.tier === "FREE") {
    return NextResponse.json({ error: "Editing posts requires Plus or Prime." }, { status: 403 })
  }

  const post = await prisma.post.findUnique({ where: { id } })
  if (!post) return NextResponse.json({ error: "Post not found." }, { status: 404 })
  if (post.userId !== user.id) return NextResponse.json({ error: "Not your post." }, { status: 403 })

  const { text } = await req.json()
  const updated = await prisma.post.update({ where: { id }, data: { text } })
  return NextResponse.json({ post: updated })
}