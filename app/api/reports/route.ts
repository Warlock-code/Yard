import { NextRequest, NextResponse } from "next/server"
import { prisma } from "@/lib/prisma"
import { getCurrentUser } from "@/lib/getCurrentUser"
import { moderateWithAI } from "@/lib/moderateWithAI"
import { rateLimit } from "@/lib/rateLimit"
import { getReadablePostWhere } from "@/lib/programAccess"

export async function POST(req: NextRequest) {
  const user = await getCurrentUser(req)
  if (!user) return NextResponse.json({ error: "Not authenticated." }, { status: 401 })

  const { postId, reason } = await req.json()
  if (!postId || !reason?.trim()) {
    return NextResponse.json({ error: "Post and reason required." }, { status: 400 })
  }
  if (typeof reason !== "string" || reason.length > 500) {
    return NextResponse.json({ error: "Report reason must be 500 characters or fewer." }, { status: 400 })
  }
  if (!rateLimit(`report:${user.id}`, 10, 60 * 60 * 1000)) {
    return NextResponse.json({ error: "Too many reports. Try again later." }, { status: 429 })
  }

  const post = await prisma.post.findFirst({ where: { id: postId, AND: [await getReadablePostWhere(user)] } })
  if (!post) return NextResponse.json({ error: "Post not found." }, { status: 404 })

  const report = await prisma.report.create({
    data: { postId, reporterId: user.id, reason },
  })

  await prisma.post.update({ where: { id: postId }, data: { archived: true } })

  const verdict = await moderateWithAI(post?.text || "", reason)

  await prisma.report.update({ where: { id: report.id }, data: { aiVerdict: verdict } })

  return NextResponse.json({ report })
}