import { NextRequest, NextResponse } from "next/server"
import { prisma } from "@/lib/prisma"
import { getCurrentUser } from "@/lib/getCurrentUser"

export async function GET(req: NextRequest) {
  const user = await getCurrentUser(req)
  if (!user) return NextResponse.json({ error: "Not authenticated." }, { status: 401 })

  const { searchParams } = new URL(req.url)
  const type = searchParams.get("type") || "posts"

  if (type === "liked") {
    const votes = await prisma.postVote.findMany({
      where: { userId: user.id },
      orderBy: { createdAt: "desc" },
      take: 30,
      include: { post: { include: { user: { select: { ghostId: true, avatarEmoji: true, tier: true } } } } },
    })
    return NextResponse.json({ posts: votes.map((v) => v.post) })
  }

  const posts = await prisma.post.findMany({
    where: { userId: user.id },
    orderBy: { createdAt: "desc" },
    take: 30,
    include: { user: { select: { ghostId: true, avatarEmoji: true, tier: true } } },
  })
  return NextResponse.json({ posts })
}