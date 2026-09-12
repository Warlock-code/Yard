import { NextRequest, NextResponse } from "next/server"
import { prisma } from "@/lib/prisma"
import { getCurrentUser } from "@/lib/getCurrentUser"
import { moderateWithAI } from "@/lib/moderateWithAI"

export async function POST(req: NextRequest) {
  const user = await getCurrentUser(req)
  if (!user) return NextResponse.json({ error: "Not authenticated." }, { status: 401 })

  const { postId, reason } = await req.json()
  if (!postId || !reason?.trim()) {
    return NextResponse.json({ error: "Post and reason required." }, { status: 400 })
  }

  const report = await prisma.report.create({
    data: { postId, reporterId: user.id, reason },
  })

  await prisma.post.update({ where: { id: postId }, data: { archived: true } })

  const post = await prisma.post.findUnique({ where: { id: postId } })
  const verdict = await moderateWithAI(post?.text || "", reason)

  await prisma.report.update({ where: { id: report.id }, data: { aiVerdict: verdict } })

  return NextResponse.json({ report })
}