import { NextRequest, NextResponse } from "next/server"
import { prisma } from "@/lib/prisma"
import { isAdmin } from "@/lib/getAdmin"
import { UTApi } from "uploadthing/server"

const BYTES_PER_MB = 1024 * 1024

export async function POST(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  if (!isAdmin(req)) {
    return NextResponse.json({ error: "Not authorized." }, { status: 403 })
  }

  const { id } = await params
  const { decision } = await req.json()

  if (decision !== "actioned" && decision !== "dismissed") {
    return NextResponse.json({ error: "Invalid decision." }, { status: 400 })
  }

  const report = await prisma.report.findUnique({ where: { id } })
  if (!report) return NextResponse.json({ error: "Not found." }, { status: 404 })

  if (report.status !== "open") {
    return NextResponse.json({ error: "This report has already been reviewed." }, { status: 409 })
  }

if (decision === "dismissed" && report.postId) {
    await prisma.$transaction(async (tx) => {
      await tx.report.update({ where: { id }, data: { status: "dismissed" } })
      // Legacy reports may have hidden a post. Never restore it while another report is waiting.
      const remainingOpenReports = await tx.report.count({
        where: { postId: report.postId!, id: { not: id }, status: "open" },
      })
      if (remainingOpenReports === 0) {
        await tx.post.updateMany({ where: { id: report.postId!, archived: true }, data: { archived: false } })
      }
    })
} else if (decision === "actioned" && report.postId) {
    const post = await prisma.post.findUnique({ where: { id: report.postId }, include: { upload: true } })
    if (post) {
      await prisma.$transaction([
        prisma.report.update({ where: { id }, data: { status: "actioned", postId: null } }),
        ...(post.upload ? [prisma.mediaUpload.delete({ where: { id: post.upload.id } })] : []),
        prisma.post.delete({ where: { id: post.id } }),
      ])
      if (post.upload) {
        await prisma.user.update({
          where: { id: post.userId },
          data: { storageUsed: { decrement: post.upload.sizeBytes / BYTES_PER_MB } },
        })
        await new UTApi().deleteFiles(post.upload.fileKey)
      }
    } else {
      await prisma.report.update({ where: { id }, data: { status: "actioned" } })
    }
  } else {
    await prisma.report.update({ where: { id }, data: { status: decision } })
  }

  return NextResponse.json({ success: true })
}
