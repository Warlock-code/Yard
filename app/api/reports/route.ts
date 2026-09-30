import { NextRequest, NextResponse } from "next/server"
import { prisma } from "@/lib/prisma"
import { getCurrentUser } from "@/lib/getCurrentUser"
import { moderateWithAI } from "@/lib/moderateWithAI"
import { rateLimit } from "@/lib/rateLimit"
import { getProgramPostWhere, getReadablePostWhere } from "@/lib/programAccess"

export async function POST(req: NextRequest) {
  const user = await getCurrentUser(req)
  if (!user) return NextResponse.json({ error: "not authenticated." }, { status: 401 })

  const { postId, reason } = await req.json()
  if (typeof postId !== "string" || !postId || typeof reason !== "string" || !reason.trim()) {
    return NextResponse.json({ error: "post and reason required." }, { status: 400 })
  }
  if (typeof reason !== "string" || reason.length > 500) {
    return NextResponse.json({ error: "report reason must be 500 characters or fewer." }, { status: 400 })
  }
  if (!(await rateLimit(`report:${user.id}`, 10, 60 * 60 * 1000))) {
    return NextResponse.json({ error: "too many reports. Try again later." }, { status: 429 })
  }

  // First try readable (visible) posts, then fall back to an already-hidden
  // (archived) post so multiple users can still report the same post while
  // it is pending admin review. The fallback re-checks campus/program
  // scope ignoring `archived` so out-of-scope posts still 404.
  let post = await prisma.post.findFirst({ where: { id: postId, AND: [await getReadablePostWhere(user)] } })
  if (!post) {
    const hidden = await prisma.post.findUnique({ where: { id: postId } })
    if (!hidden) return NextResponse.json({ error: "post not found." }, { status: 404 })
    const inScope = await prisma.post.findFirst({
      where: {
        id: postId,
        OR: [
          { visibility: "school" },
          { AND: [{ visibility: "program" }, await getProgramPostWhere(user)] },
        ],
      },
    })
    if (!inScope) return NextResponse.json({ error: "post not found." }, { status: 404 })
    post = hidden
  }
  if (post.userId === user.id) {
    return NextResponse.json({ error: "you cannot report your own post." }, { status: 400 })
  }

  let report
  try {
    report = await prisma.report.create({
      data: { postId, reporterId: user.id, reason: reason.trim() },
    })
  } catch (error: unknown) {
    if (typeof error === "object" && error !== null && "code" in error && error.code === "P2002") {
      return NextResponse.json({ error: "you have already reported this post." }, { status: 409 })
    }
    throw error
  }

  // Hide immediately pending admin review. Admin "dismissed" restores
  // (archived -> false) and "actioned" deletes the post.
  await prisma.post.updateMany({ where: { id: postId, archived: false }, data: { archived: true } })

  const verdict = await moderateWithAI(post?.text || "", reason)

  await prisma.report.update({ where: { id: report.id }, data: { aiVerdict: verdict } })

  return NextResponse.json({ report, hidden: true }, { status: 201 })
}
