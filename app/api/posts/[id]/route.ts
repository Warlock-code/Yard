import { NextRequest, NextResponse } from "next/server"
import { prisma } from "@/lib/prisma"
import { getCurrentUser } from "@/lib/getCurrentUser"
import { UTApi } from "uploadthing/server"
import { getReadablePostWhere } from "@/lib/programAccess"

const BYTES_PER_MB = 1024 * 1024

export async function GET(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const viewer = await getCurrentUser(req)
  if (!viewer) return NextResponse.json({ error: "Not authenticated." }, { status: 401 })

  const { id } = await params
  const post = await prisma.post.findFirst({
    where: {
      id,
      AND: [await getReadablePostWhere(viewer)],
    },
    select: {
      id: true,
      text: true,
      imageUrl: true,
      yeahs: true,
      commentsCount: true,
      createdAt: true,
      user: { select: { ghostId: true, avatarEmoji: true, tier: true } },
    },
  })
  if (!post) return NextResponse.json({ error: "Post not found." }, { status: 404 })

  return NextResponse.json({ post })
}

export async function DELETE(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params
  const user = await getCurrentUser(req)
  if (!user) return NextResponse.json({ error: "Not authenticated." }, { status: 401 })

  const post = await prisma.post.findUnique({ where: { id }, include: { upload: true } })
  if (!post) return NextResponse.json({ error: "Post not found." }, { status: 404 })
  if (post.userId !== user.id) return NextResponse.json({ error: "Not your post." }, { status: 403 })

  await prisma.$transaction([
    ...(post.upload
      ? [prisma.mediaUpload.delete({ where: { id: post.upload.id } })]
      : []),
    prisma.post.delete({ where: { id } }),
  ])
  if (post.upload) {
    await prisma.user.update({
      where: { id: user.id },
      data: { storageUsed: { decrement: post.upload.sizeBytes / BYTES_PER_MB } },
    })
    await new UTApi().deleteFiles(post.upload.fileKey)
  }
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