import { NextRequest, NextResponse } from "next/server"
import { prisma } from "@/lib/prisma"
import { getCurrentUser } from "@/lib/getCurrentUser"
import { getEffectiveTier } from "@/lib/tier"

export const dynamic = "force-dynamic"

// Who engaged with YOUR post. Privacy-safe by design: exact ghosts are
// never revealed — only aggregate programs/years. Free sees counts,
// PLUS sees programs, PRIME sees programs + years + follower context.
export async function GET(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const user = await getCurrentUser(req)
  if (!user) return NextResponse.json({ error: "not authenticated." }, { status: 401 })

  const { id } = await params
  const post = await prisma.post.findUnique({
    where: { id },
    select: { id: true, userId: true },
  })
  if (!post) return NextResponse.json({ error: "post not found." }, { status: 404 })
  if (post.userId !== user.id) return NextResponse.json({ error: "hints are only for your own posts." }, { status: 403 })

  const tier = getEffectiveTier(user)

  const [views, votes] = await Promise.all([
    prisma.postView.findMany({ where: { postId: id }, select: { userId: true }, take: 5000 }),
    prisma.postVote.findMany({ where: { postId: id }, select: { userId: true }, take: 5000 }),
  ])
  const ids = [...new Set([...views.map((v) => v.userId), ...votes.map((v) => v.userId)])]

  const result: {
    views: number
    heats: number
    byProgram?: { program: string; views: number; heats: number }[]
    byYear?: { cohortYear: number; views: number; heats: number }[]
    followerContext?: { followingYou: number; youFollow: number }
  } = { views: views.length, heats: votes.length }

  if (tier === "FREE" || ids.length === 0) return NextResponse.json(result)

  const [viewSet, voteSet] = [new Set(views.map((v) => v.userId)), new Set(votes.map((v) => v.userId))]
  const people = await prisma.user.findMany({
    where: { id: { in: ids } },
    select: { id: true, program: true, cohortYear: true },
  })

  const prog = new Map<string, { views: number; heats: number }>()
  const years = new Map<number, { views: number; heats: number }>()
  for (const p of people) {
    const v = viewSet.has(p.id) ? 1 : 0
    const h = voteSet.has(p.id) ? 1 : 0
    const pk = (p.program || "undeclared").toLowerCase()
    const pe = prog.get(pk) || { views: 0, heats: 0 }
    pe.views += v
    pe.heats += h
    prog.set(pk, pe)
    if (p.cohortYear != null) {
      const ye = years.get(p.cohortYear) || { views: 0, heats: 0 }
      ye.views += v
      ye.heats += h
      years.set(p.cohortYear, ye)
    }
  }
  result.byProgram = [...prog.entries()]
    .map(([program, s]) => ({ program, ...s }))
    .sort((a, b) => b.views + b.heats - (a.views + a.heats))
    .slice(0, 10)

  if (tier === "PRIME") {
    result.byYear = [...years.entries()]
      .map(([cohortYear, s]) => ({ cohortYear, ...s }))
      .sort((a, b) => b.cohortYear - a.cohortYear)
      .slice(0, 12)
    const [followingYou, youFollow] = await Promise.all([
      prisma.follow.count({ where: { followingId: user.id, followerId: { in: ids } } }),
      prisma.follow.count({ where: { followerId: user.id, followingId: { in: ids } } }),
    ])
    result.followerContext = { followingYou, youFollow }
  }

  return NextResponse.json(result)
}
