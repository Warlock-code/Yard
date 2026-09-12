import { NextRequest, NextResponse } from "next/server"
import { prisma } from "@/lib/prisma"
import { getCurrentUser } from "@/lib/getCurrentUser"

const ADMIN_EMAILS = [process.env.ADMIN_EMAIL || ""]

export async function POST(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params
  const user = await getCurrentUser(req)
  if (!user || !ADMIN_EMAILS.includes(user.email)) {
    return NextResponse.json({ error: "Not authorized." }, { status: 403 })
  }

  const { decision } = await req.json()

  const report = await prisma.report.findUnique({ where: { id } })
  if (!report) return NextResponse.json({ error: "Report not found." }, { status: 404 })

  if (decision === "dismissed" && report.postId) {
    await prisma.post.update({ where: { id: report.postId }, data: { archived: false } })
  }
  if (decision === "actioned" && report.postId) {
    await prisma.post.delete({ where: { id: report.postId } })
  }

  await prisma.report.update({ where: { id }, data: { status: decision } })

  return NextResponse.json({ success: true })
}