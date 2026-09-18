import { NextRequest, NextResponse } from "next/server"
import { prisma } from "@/lib/prisma"
import { getCurrentUser } from "@/lib/getCurrentUser"

export const dynamic = "force-dynamic"

export async function GET(req: NextRequest) {
  const user = await getCurrentUser(req)
  if (!user) return NextResponse.json({ error: "Not authenticated." }, { status: 401 })

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
      score: u.posts.reduce((s, p) => s + p.yeahs, 0) + u.battleEntries.reduce((s, e) => s + e.votes, 0),
    }))
    .sort((a, b) => b.score - a.score)

  const top10 = ranked.slice(0, 10)
  const myRank = ranked.findIndex((r) => r.id === user.id) + 1
  const me = ranked.find((r) => r.id === user.id)

  return NextResponse.json({ leaderboard: top10, myRank, me })
}