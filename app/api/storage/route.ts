import { NextRequest, NextResponse } from "next/server"
import { prisma } from "@/lib/prisma"
import { getCurrentUser } from "@/lib/getCurrentUser"
import { getEffectiveStorageLimitMB } from "@/lib/tier"
import { UTApi } from "uploadthing/server"

const BYTES_PER_MB = 1024 * 1024

export async function GET(req: NextRequest) {
  const user = await getCurrentUser(req)
  if (!user) return NextResponse.json({ error: "Not authenticated." }, { status: 401 })

  const uploads = await prisma.mediaUpload.findMany({
    where: { userId: user.id, status: "active", postId: null },
    orderBy: { createdAt: "desc" },
    take: 20,
  })

  return NextResponse.json({
    uploads: uploads.map((upload) => ({
      id: upload.id,
      url: upload.url,
      sizeBytes: upload.sizeBytes,
    })),
  })
}

export async function DELETE(req: NextRequest) {
  const user = await getCurrentUser(req)
  if (!user) return NextResponse.json({ error: "Not authenticated." }, { status: 401 })

  const { url } = await req.json()
  if (typeof url !== "string" || !url) {
    return NextResponse.json({ error: "Image URL is invalid." }, { status: 400 })
  }

  const upload = await prisma.mediaUpload.findUnique({ where: { url } })
  if (!upload || upload.userId !== user.id) {
    return NextResponse.json({ error: "Image not found." }, { status: 404 })
  }
  if (upload.postId) {
    return NextResponse.json({ error: "Image is attached to a post." }, { status: 400 })
  }

  const utapi = new UTApi()
  await utapi.deleteFiles(upload.fileKey)

  const [, updatedUser] = await prisma.$transaction([
    prisma.mediaUpload.delete({ where: { url } }),
    prisma.user.update({
      where: { id: user.id },
      data: { storageUsed: { decrement: upload.sizeBytes / BYTES_PER_MB } },
    }),
  ])

  return NextResponse.json({
    success: true,
    storageUsed: Math.max(0, updatedUser.storageUsed),
    storageLimit: getEffectiveStorageLimitMB(updatedUser),
    storageRemaining: Math.max(0, getEffectiveStorageLimitMB(updatedUser) - updatedUser.storageUsed),
  })
}
