import { NextRequest, NextResponse } from "next/server"
import { prisma } from "@/lib/prisma"
import { getCurrentUser } from "@/lib/getCurrentUser"

export async function POST(req: NextRequest) {
  const user = await getCurrentUser(req)
  if (!user) return NextResponse.json({ error: "Not authenticated." }, { status: 401 })

  const { targetUserId } = await req.json()
  if (targetUserId === user.id) {
    return NextResponse.json({ error: "Can't follow yourself." }, { status: 400 })
  }

  try {
    await prisma.follow.create({ data: { followerId: user.id, followingId: targetUserId } })
  } catch (err: any) {
    if (err.code === "P2002") {
      await prisma.follow.delete({
        where: { followerId_followingId: { followerId: user.id, followingId: targetUserId } },
      })
      return NextResponse.json({ following: false })
    }
    throw err
  }

  return NextResponse.json({ following: true })
}