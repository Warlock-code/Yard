import { NextRequest, NextResponse } from "next/server"
import { prisma } from "@/lib/prisma"
import { isAdmin } from "@/lib/getAdmin"
import { UTApi } from "uploadthing/server"

export const dynamic = "force-dynamic"

const BYTES_PER_MB = 1024 * 1024

export async function DELETE(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  if (!isAdmin(req)) return NextResponse.json({ error: "Not authorized." }, { status: 403 })
  const { id } = await params

  const post = await prisma.post.findUnique({ where: { id }, include: { upload: true } })
  if (!post) return NextResponse.json({ error: "Post not found." }, { status: 404 })

  await prisma.$transaction([
    ...(post.upload ? [prisma.mediaUpload.delete({ where: { id: post.upload.id } })] : []),
    prisma.post.delete({ where: { id } }),
  ])
  if (post.upload) {
    await prisma.user.update({
      where: { id: post.userId },
      data: { storageUsed: { decrement: post.upload.sizeBytes / BYTES_PER_MB } },
    })
    await new UTApi().deleteFiles(post.upload.fileKey)
  }
  return NextResponse.json({ success: true })
}