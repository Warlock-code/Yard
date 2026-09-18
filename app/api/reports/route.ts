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
  if (typeof postId !== "string" || !postId || typeof reason !== "string" || !reason.trim()) {
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
  if (post.userId === user.id) {
    return NextResponse.json({ error: "You cannot report your own post." }, { status: 400 })
  }

  let report
  try {
    report = await prisma.report.create({
      data: { postId, reporterId: user.id, reason: reason.trim() },
    })
  } catch (error: unknown) {
    if (typeof error === "object" && error !== null && "code" in error && error.code === "P2002") {
      return NextResponse.json({ error: "You have already reported this post." }, { status: 409 })
    }
    throw error
  }

  const verdict = await moderateWithAI(post?.text || "", reason)

  await prisma.report.update({ where: { id: report.id }, data: { aiVerdict: verdict } })

  return NextResponse.json({ report }, { status: 201 })
}
