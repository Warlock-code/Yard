import { NextRequest, NextResponse } from "next/server"
import { prisma } from "@/lib/prisma"
import { getCurrentUser } from "@/lib/getCurrentUser"
import { getEffectiveTier } from "@/lib/tier"

export const dynamic = "force-dynamic"

function parseDateRange(searchParams: URLSearchParams) {
  const range = searchParams.get("range") || "30d"
  const now = new Date()
  let startDate: Date

  switch (range) {
    case "7d":
      startDate = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000)
      break
    case "30d":
      startDate = new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000)
      break
    case "90d":
      startDate = new Date(now.getTime() - 90 * 24 * 60 * 60 * 1000)
      break
    case "all":
      startDate = new Date(0)
      break
    default:
      startDate = new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000)
  }

  const customStart = searchParams.get("start")
  const customEnd = searchParams.get("end")
  if (customStart) startDate = new Date(customStart)
  const endDate = customEnd ? new Date(customEnd) : now

  return { startDate, endDate, range }
}

function getPeriodStart(date: Date, period: "day" | "week" | "month") {
  const d = new Date(date)
  if (period === "day") {
    d.setHours(0, 0, 0, 0)
  } else if (period === "week") {
    d.setDate(d.getDate() - d.getDay())
    d.setHours(0, 0, 0, 0)
  } else {
    d.setDate(1)
    d.setHours(0, 0, 0, 0)
  }
  return d
}

export async function GET(req: NextRequest) {
  const user = await getCurrentUser(req)
  if (!user) return NextResponse.json({ error: "not authenticated." }, { status: 401 })

  const effectiveTier = getEffectiveTier(user)
  if (effectiveTier !== "PRIME") {
    void prisma.paywallHit.create({ data: { userId: user?.id ?? null, feature: "analytics", pathname: req.nextUrl?.pathname ?? null } }).catch(()=>{})
    return NextResponse.json({ error: "analytics is prime exclusive — upgrade to prime to unlock it." }, { status: 403 })
  }

  const { startDate, endDate, range } = parseDateRange(new URL(req.url).searchParams)
  const period = (new URL(req.url).searchParams.get("period") as "day" | "week" | "month") || "day"

  // Credit-based rewards (in-app only, no cash value). VOTE_REWARD references
  // a post id, BATTLE_WIN references a prompt id, LEADERBOARD a window key.
  const txns = await prisma.creditTransaction.findMany({
    where: {
      userId: user.id,
      amount: { gt: 0 },
      type: { in: ["VOTE_REWARD", "BATTLE_WIN", "LEADERBOARD"] },
      createdAt: { gte: startDate, lte: endDate },
    },
    orderBy: { createdAt: "asc" },
    select: { type: true, reference: true, amount: true, createdAt: true },
  })

  const earnings = txns.map((t) => ({
    source:
      t.type === "VOTE_REWARD" ? "post_vote" : t.type === "BATTLE_WIN" ? "battle_win" : "leaderboard_bonus",
    sourceId: t.reference,
    amount: t.amount,
    createdAt: t.createdAt,
  }))

  const bySource = earnings.reduce((acc, e) => {
    acc[e.source] = (acc[e.source] || 0) + e.amount
    return acc
  }, {} as Record<string, number>)

  const byDateMap = new Map<string, { posts: number; battles: number; leaderboard: number; total: number }>()
  for (const e of earnings) {
    const periodStart = getPeriodStart(e.createdAt, period)
    const key = periodStart.toISOString().slice(0, 10)
    const current = byDateMap.get(key) || { posts: 0, battles: 0, leaderboard: 0, total: 0 }

    if (e.source === "post_vote") current.posts += e.amount
    else if (e.source === "battle_win") current.battles += e.amount
    else if (e.source === "leaderboard_bonus") current.leaderboard += e.amount

    current.total += e.amount
    byDateMap.set(key, current)
  }

  const byDate = Array.from(byDateMap.entries())
    .map(([date, data]) => ({ date, ...data }))
    .sort((a, b) => a.date.localeCompare(b.date))

  const postEarnings = earnings.filter((e) => e.source === "post_vote" && e.sourceId)
  const battleEarnings = earnings.filter((e) => e.source === "battle_win" && e.sourceId)
  const leaderboardEarnings = earnings.filter((e) => e.source === "leaderboard_bonus")

  const postIds = [
    ...new Set(
      postEarnings
        .map((e) => e.sourceId)
        .filter((id): id is string => typeof id === "string" && id.length > 0)
    ),
  ]

  const battleEntryIds = [
    ...new Set(
      battleEarnings
        .map((e) => e.sourceId)
        .filter((id): id is string => typeof id === "string" && id.length > 0)
    ),
  ]

  const posts = await prisma.post.findMany({
    where: { id: { in: postIds } },
    select: { id: true, text: true, createdAt: true, yeahs: true, commentsCount: true },
  })

  const postsWithImages = await prisma.post.findMany({
    where: { id: { in: postIds } },
    select: { id: true, imageUrl: true },
  })
  const imageMap = new Map(postsWithImages.map((p) => [p.id, p.imageUrl ?? undefined]))

  // BATTLE_WIN references a battle prompt id (not an entry id).
  const battlePrompts = await prisma.battlePrompt.findMany({
    where: { id: { in: battleEntryIds } },
    select: { id: true, text: true },
  })
  const promptMap = new Map(battlePrompts.map((p) => [p.id, p.text]))

  const postMap = new Map(posts.map((p) => [p.id, { ...p, imageUrl: imageMap.get(p.id) }]))

  const postBreakdown = postIds.map((id) => {
    const post = postMap.get(id)
    const amount = postEarnings.filter((e) => e.sourceId === id).reduce((s, e) => s + e.amount, 0)
    return {
      postId: id,
      text: post?.text?.slice(0, 100) || "",
      imageUrl: post?.imageUrl ?? undefined,
      amount,
      createdAt: post?.createdAt,
    }
  })

  const battleBreakdown = battleEntryIds.map((id) => {
    const amount = battleEarnings.filter((e) => e.sourceId === id).reduce((s, e) => s + e.amount, 0)
    const first = battleEarnings.find((e) => e.sourceId === id)
    return {
      battleEntryId: id,
      promptText: promptMap.get(id) || "",
      text: "",
      amount,
      createdAt: first?.createdAt,
      votes: 0,
    }
  })

  const leaderboardBreakdown = leaderboardEarnings.map((e) => ({
    amount: e.amount,
    createdAt: e.createdAt,
  }))

  const totalEarned = earnings.reduce((s, e) => s + e.amount, 0)

  return NextResponse.json({
    range,
    period,
    totalEarned,
    bySource,
    byDate,
    breakdown: {
      posts: postBreakdown,
      battles: battleBreakdown,
      leaderboard: leaderboardBreakdown,
    },
  })
}