import { NextRequest, NextResponse } from "next/server"
import { prisma } from "@/lib/prisma"
import { getCurrentUser } from "@/lib/getCurrentUser"

export async function POST(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params
  const user = await getCurrentUser(req)
  if (!user) return NextResponse.json({ error: "Not authenticated." }, { status: 401 })

  const post = await prisma.post.findUnique({ where: { id } })
  if (!post) return NextResponse.json({ error: "Post not found." }, { status: 404 })
  if (post.userId !== user.id) {
    return NextResponse.json({ error: "You can only boost your own posts." }, { status: 403 })
  }

  if (user.freeBoosts > 0) {
    await prisma.$transaction([
      prisma.user.update({ where: { id: user.id }, data: { freeBoosts: { decrement: 1 } } }),
      prisma.post.update({
        where: { id },
        data: { boosted: true, boostedUntil: new Date(Date.now() + 24 * 60 * 60 * 1000) },
      }),
    ])
    return NextResponse.json({ success: true })
  }

  return NextResponse.json({ error: "Buy boost credits in the Shop." }, { status: 402 })
}