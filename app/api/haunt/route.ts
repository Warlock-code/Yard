import { NextRequest, NextResponse } from "next/server"
import { prisma } from "@/lib/prisma"
import { getCurrentUser } from "@/lib/getCurrentUser"

export const dynamic = "force-dynamic"

// Haunt streak — consecutive days VISITING (session heartbeat), broader than
// the posting streak. Display + retention hook; sessions already exist.
// No new columns: streak is computed from distinct UserSession days merged
// with AnalyticsEvent `visit` days. POST is the heartbeat (idempotent/day).
function dayKey(d = new Date()) {
  return d.toISOString().slice(0, 10)
}

function countStreak(days: Set<string>): number {
  let streak = 0
  const cursor = new Date()
  // Allow today-or-yesterday as streak head (visited recently counts).
  if (!days.has(dayKey(cursor))) cursor.setDate(cursor.getDate() - 1)
  while (days.has(dayKey(cursor))) {
    streak += 1
    cursor.setDate(cursor.getDate() - 1)
  }
  return streak
}

async function activeDays(userId: string): Promise<{ streakDays: number; activeDays: number }> {
  try {
    const [sessions, visits] = await Promise.all([
      prisma.userSession
        .findMany({
          where: { userId },
          orderBy: { startedAt: "desc" },
          take: 60,
          select: { startedAt: true },
        })
        .catch(() => []),
      prisma.analyticsEvent
        .findMany({
          where: { userId, type: "visit" },
          orderBy: { createdAt: "desc" },
          take: 60,
          select: { createdAt: true },
        })
        .catch(() => []),
    ])
    const days = new Set<string>([
      ...sessions.map((s) => dayKey(s.startedAt)),
      ...visits.map((v) => dayKey(v.createdAt)),
    ])
    return { streakDays: countStreak(days), activeDays: days.size }
  } catch {
    return { streakDays: 0, activeDays: 0 }
  }
}

export async function GET(req: NextRequest) {
  const user = await getCurrentUser(req)
  if (!user) return NextResponse.json({ error: "not authenticated." }, { status: 401 })

  return NextResponse.json(await activeDays(user.id))
}

export async function POST(req: NextRequest) {
  const user = await getCurrentUser(req)
  if (!user) return NextResponse.json({ error: "not authenticated." }, { status: 401 })

  const body = await req.json().catch(() => ({}))
  const pathname = typeof body.pathname === "string" ? body.pathname.slice(0, 200) : null
  const platform = req.headers.get("x-platform")?.slice(0, 32) ?? null
  const today = dayKey()

  // 1. Visit heartbeat — analytics trail for the streak + FOMO loops.
  try {
    await prisma.analyticsEvent.create({
      data: { userId: user.id, type: "visit", pathname, metadata: { source: "haunt" } },
    })
  } catch {
    // table missing pre-migration — ignore
  }

  // 2. One UserSession per day (skip if today already has one).
  try {
    const dayStart = new Date(`${today}T00:00:00.000Z`)
    const existing = await prisma.userSession.findFirst({
      where: { userId: user.id, startedAt: { gte: dayStart } },
      select: { id: true },
    })
    if (!existing) {
      await prisma.userSession.create({
        data: { userId: user.id, pathname, platform },
      })
    }
  } catch {
    // table missing pre-migration — visits above still count
  }

  return NextResponse.json({ success: true, ...(await activeDays(user.id)) })
}
