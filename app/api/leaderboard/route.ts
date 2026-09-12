import { NextRequest, NextResponse } from "next/server"
import { prisma } from "@/lib/prisma"
import { getCurrentUser } from "@/lib/getCurrentUser"

export async function GET(req: NextRequest) {
  const user = await getCurrentUser(req)
  if (!user) return NextResponse.json({ error: "Not authenticated." }, { status: 401 })

  // simple ranking: total yeahs across all their posts + battle votes
  const users = await prisma.user.findMany({
    where: { campus: user.campus },
    select: {
      id: true,
      ghostId: true,
      avatarEmoji: true,
      tier: true,
      posts: { select: { yeahs: true } },
      battleEntries: { select: { votes: true } },
    },
  })

  const ranked = users
    .map((u) => ({
      id: u.id,
      ghostId: u.ghostId,
      avatarEmoji: u.avatarEmoji,
      tier: u.tier,
      score:
        u.posts.reduce((sum, p) => sum + p.yeahs, 0) +
        u.battleEntries.reduce((sum, e) => sum + e.votes, 0),
    }))
    .sort((a, b) => b.score - a.score)

  return NextResponse.json({ leaderboard: ranked })
}