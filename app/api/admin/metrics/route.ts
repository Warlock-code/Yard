import { NextRequest, NextResponse } from "next/server"
import { prisma } from "@/lib/prisma"
import { isAdmin } from "@/lib/getAdmin"

export const dynamic = "force-dynamic"

function dayOf(d: Date): string {
  return d.toISOString().slice(0, 10)
}

export async function GET(req: NextRequest) {
  if (!isAdmin(req)) return NextResponse.json({ error: "Not authorized." }, { status: 403 })

  const raw = Number(req.nextUrl.searchParams.get("range") ?? 30)
  const range = Number.isFinite(raw) ? Math.min(90, Math.max(1, Math.floor(raw))) : 30

  // Ascending UTC day labels for the window; all per-day maps start zero-filled.
  const days: string[] = []
  for (let i = range - 1; i >= 0; i--) {
    days.push(dayOf(new Date(Date.now() - i * 24 * 60 * 60 * 1000)))
  }
  const start = new Date(days[0] + "T00:00:00.000Z")
  const windowFilter = { gte: start }

  // All heavy reads are capped to the `range`-day window; lifetime counts mirror the stats route.
  const [
    posts,
    comments,
    votes,
    checkoutStarted,
    paidCount,
    userCount,
    plusCount,
    primeCount,
    revenueAgg,
    paidOutAgg,
    payers,
    signups,
    activeUsersByDay,
  ] = await Promise.all([
    prisma.post.findMany({ where: { createdAt: windowFilter }, select: { userId: true, createdAt: true } }),
    prisma.comment.findMany({ where: { createdAt: windowFilter }, select: { userId: true, createdAt: true } }),
    prisma.postVote.findMany({ where: { createdAt: windowFilter }, select: { userId: true, createdAt: true } }),
    prisma.transaction.count({ where: { status: "pending", createdAt: windowFilter } }),
    prisma.transaction.count({ where: { status: "success", createdAt: windowFilter } }),
    prisma.user.count(),
    prisma.user.count({ where: { tier: "PLUS" } }),
    prisma.user.count({ where: { tier: "PRIME" } }),
    prisma.transaction.aggregate({ where: { status: "success", createdAt: windowFilter }, _sum: { amount: true } }),
    prisma.payout.aggregate({ where: { status: "paid", requestedAt: windowFilter }, _sum: { amount: true } }),
    prisma.transaction.findMany({
      where: { status: "success", createdAt: windowFilter },
      select: { userId: true },
      distinct: ["userId"],
    }),
    prisma.user.findMany({
      where: { createdAt: windowFilter },
      select: { id: true, createdAt: true },
    }),
    prisma.user.findMany({
      where: {
        OR: [
          { posts: { some: { createdAt: windowFilter } } },
          { comments: { some: { createdAt: windowFilter } } },
          { votes: { some: { createdAt: windowFilter } } },
        ],
      },
      select: { id: true, createdAt: true },
    }),
  ])

  const dauByDay = new Map<string, Set<string>>(days.map((d) => [d, new Set<string>()]))
  const postsByDay = new Map<string, number>(days.map((d) => [d, 0]))
  const paywallByDay = new Map<string, number>(days.map((d) => [d, 0]))
  const signupsByDay = new Map<string, Set<string>>(days.map((d) => [d, new Set<string>()]))
  const paidSignupsByDay = new Map<string, Set<string>>(days.map((d) => [d, new Set<string>()]))

  for (const p of posts) {
    const day = dayOf(p.createdAt)
    if (postsByDay.has(day)) postsByDay.set(day, (postsByDay.get(day) ?? 0) + 1)
    dauByDay.get(day)?.add(p.userId)
  }
  for (const c of comments) dauByDay.get(dayOf(c.createdAt))?.add(c.userId)
  for (const v of votes) dauByDay.get(dayOf(v.createdAt))?.add(v.userId)

  // Signups per day (for retention cohorts)
  for (const u of signups) {
    const day = dayOf(u.createdAt)
    if (signupsByDay.has(day)) signupsByDay.get(day)?.add(u.id)
  }

  // Paid signups per day (pay conversion)
  const paidUserIds = new Set(payers.map(p => p.userId))
  for (const u of signups) {
    if (paidUserIds.has(u.id)) {
      const day = dayOf(u.createdAt)
      if (paidSignupsByDay.has(day)) paidSignupsByDay.get(day)?.add(u.id)
    }
  }

  // Signup cohort posting activity: how many signups post on day 0 (signup day) and day 1 (next day)
  const signupPostDay0 = new Map<string, number>(days.map((d) => [d, 0]))
  const signupPostDay1 = new Map<string, number>(days.map((d) => [d, 0]))
  
  // Get all posts by users who signed up in the window
  const signupUserIds = new Set(signups.map(u => u.id))
  const signupUserPosts = await prisma.post.findMany({
    where: {
      userId: { in: [...signupUserIds] },
      createdAt: { gte: start },
    },
    select: { userId: true, createdAt: true },
  })
  
  // Map signup day for each user
  const userSignupDay = new Map<string, string>()
  for (const u of signups) {
    userSignupDay.set(u.id, dayOf(u.createdAt))
  }
  
  for (const p of signupUserPosts) {
    const signupDay = userSignupDay.get(p.userId)
    if (!signupDay) continue
    const postDay = dayOf(p.createdAt)
    const diffDays = Math.floor((new Date(postDay).getTime() - new Date(signupDay).getTime()) / (24 * 60 * 60 * 1000))
    if (diffDays === 0 && signupPostDay0.has(signupDay)) {
      signupPostDay0.set(signupDay, (signupPostDay0.get(signupDay) ?? 0) + 1)
    } else if (diffDays === 1 && signupPostDay1.has(signupDay)) {
      signupPostDay1.set(signupDay, (signupPostDay1.get(signupDay) ?? 0) + 1)
    }
  }

  // PaywallHit table may not exist yet (migration pending) — fall back to zeros.
  let hits = 0
  try {
    const paywallHits = await prisma.paywallHit.findMany({
      where: { createdAt: windowFilter },
      select: { createdAt: true },
    })
    for (const h of paywallHits) {
      const day = dayOf(h.createdAt)
      if (paywallByDay.has(day)) {
        paywallByDay.set(day, (paywallByDay.get(day) ?? 0) + 1)
        hits += 1
      }
    }
  } catch {
    // Table missing — keep the zero-filled series and hits = 0.
  }

  // Retention: D1 and D7 for each cohort day
  const retentionD1 = new Map<string, number>()
  const retentionD7 = new Map<string, number>()
  const signupDays = Array.from(signupsByDay.keys())
  
  for (const cohortDay of signupDays) {
    const cohort = signupsByDay.get(cohortDay) || new Set()
    if (cohort.size === 0) {
      retentionD1.set(cohortDay, 0)
      retentionD7.set(cohortDay, 0)
      continue
    }
    // D1 = next day
    const d1Day = dayOf(new Date(new Date(cohortDay).getTime() + 24 * 60 * 60 * 1000))
    const d7Day = dayOf(new Date(new Date(cohortDay).getTime() + 7 * 24 * 60 * 60 * 1000))
    
    const d1Active = dauByDay.get(d1Day) || new Set()
    const d7Active = dauByDay.get(d7Day) || new Set()
    
    let d1Retained = 0
    let d7Retained = 0
    for (const uid of cohort) {
      if (d1Active.has(uid)) d1Retained++
      if (d7Active.has(uid)) d7Retained++
    }
    retentionD1.set(cohortDay, cohort.size > 0 ? Math.round((d1Retained / cohort.size) * 100) : 0)
    retentionD7.set(cohortDay, cohort.size > 0 ? Math.round((d7Retained / cohort.size) * 100) : 0)
  }

  const plusRate = userCount > 0 ? plusCount / userCount : 0
  const primeRate = userCount > 0 ? primeCount / userCount : 0
  const paidRate = userCount > 0 ? (plusCount + primeCount) / userCount : 0

  const revenuePesewas = revenueAgg._sum.amount ?? 0
  const paidOutPesewas = paidOutAgg._sum.amount ?? 0
  const arppuPesewas = payers.length > 0 ? revenuePesewas / payers.length : 0
  const payoutRatio = revenuePesewas > 0 ? paidOutPesewas / revenuePesewas : 0

  // Posts per active user per day
  const postsPerUserByDay = days.map((day) => {
    const dau = dauByDay.get(day)?.size ?? 0
    const posts = postsByDay.get(day) ?? 0
    return { day, count: dau > 0 ? Number((posts / dau).toFixed(2)) : 0 }
  })

  // Pay conversion per day (% of signups that became paid)
  const payConversionByDay = days.map((day) => {
    const signups = signupsByDay.get(day)?.size ?? 0
    const paid = paidSignupsByDay.get(day)?.size ?? 0
    return { day, rate: signups > 0 ? Number(((paid / signups) * 100).toFixed(2)) : 0 }
  })

  // Signup cohort posting rates
  const signupPostRateDay0 = days.map((day) => {
    const signups = signupsByDay.get(day)?.size ?? 0
    const posted = signupPostDay0.get(day) ?? 0
    return { day, count: posted, rate: signups > 0 ? Number(((posted / signups) * 100).toFixed(2)) : 0 }
  })
  const signupPostRateDay1 = days.map((day) => {
    const signups = signupsByDay.get(day)?.size ?? 0
    const posted = signupPostDay1.get(day) ?? 0
    return { day, count: posted, rate: signups > 0 ? Number(((posted / signups) * 100).toFixed(2)) : 0 }
  })

  return NextResponse.json({
    range,
    dau: days.map((day) => ({ day, count: dauByDay.get(day)?.size ?? 0 })),
    postsPerDay: days.map((day) => ({ day, count: postsByDay.get(day) ?? 0 })),
    postsPerUserByDay,
    paywallHits: days.map((day) => ({ day, count: paywallByDay.get(day) ?? 0 })),
    funnel: { hits, checkoutStarted, paid: paidCount },
    conversion: { userCount, plusCount, primeCount, plusRate, primeRate, paidRate },
    payConversionByDay,
    retentionD1: signupDays.map((day) => ({ day, rate: retentionD1.get(day) ?? 0 })),
    retentionD7: signupDays.map((day) => ({ day, rate: retentionD7.get(day) ?? 0 })),
    arppuPesewas,
    revenuePesewas,
    paidOutPesewas,
    payoutRatio,
    signupPostDay0: signupPostRateDay0,
    signupPostDay1: signupPostRateDay1,
  })
}
