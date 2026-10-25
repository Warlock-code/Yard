import { NextRequest, NextResponse } from "next/server"
import { prisma } from "@/lib/prisma"
import { isAdmin } from "@/lib/getAdmin"
import { createNotification } from "@/lib/notifications"
import { BATTLE_DURATION_HOURS, BATTLE_DURATION_MS, newBattleText } from "@/lib/battle-countdown"
import { CAMPUSES } from "@/lib/schoolEmails"

const VALID_CAMPUSES = CAMPUSES

export const dynamic = "force-dynamic"
export const revalidate = 0
export const fetchCache = "force-no-store"

export async function POST(req: NextRequest) {
  if (!isAdmin(req)) {
    return NextResponse.json({ error: "not authorized." }, { status: 403 })
  }

  const {
    text,
    campus,
    type = "SINGLE",
    totalRounds = 1,
    entryType = "TEXT",
    schedule = "once",
    scheduleTime,
    scheduleDays,
    seasonId,
  } = await req.json()

  if (!text?.trim() || !campus) {
    return NextResponse.json({ error: "prompt text and campus required." }, { status: 400 })
  }
  if (!VALID_CAMPUSES.includes(campus)) {
    return NextResponse.json({ error: "invalid campus." }, { status: 400 })
  }

  const now = new Date()
  const startsAt = scheduleTime ? new Date(scheduleTime) : now
  // Official battles always run for exactly 72 hours (3 days) from their start.
  const endsAt = new Date(startsAt.getTime() + BATTLE_DURATION_MS)

  let season: { id: string } | null = null
  if (seasonId) {
    season = await prisma.battleSeason.findUnique({ where: { id: seasonId }, select: { id: true } })
    if (!season) {
      return NextResponse.json({ error: "season not found." }, { status: 400 })
    }
  }

  if (type === "BRACKET" && totalRounds < 2) {
    return NextResponse.json({ error: "bracket battles need at least 2 rounds." }, { status: 400 })
  }

  const prompt = await prisma.battlePrompt.create({
    data: {
      text,
      campus,
      type,
      status: startsAt > now ? "UPCOMING" : "ACTIVE",
      startsAt,
      endsAt,
      totalRounds,
      roundNumber: 1,
      entryType,
      seasonId: season?.id,
    },
  })

  if (schedule !== "once" && scheduleDays && scheduleDays.length > 0) {
    const scheduleData = {
      promptId: prompt.id,
      campus,
      text,
      type,
      totalRounds,
      entryType,
      durationHours: BATTLE_DURATION_HOURS,
      schedule,
      scheduleTime,
      scheduleDays,
      seasonId,
    }
    // Schedule handling would go here (e.g., using external cron service)
    console.log("Scheduled battle:", scheduleData)
  }

  // Instant alert: every user on this campus hears about the new battle.
  // Fire-and-forget safe — notification failures never fail the create.
  // Capped + chunked so a big campus can't hang the admin's request.
  try {
    const copy = newBattleText({ text, status: prompt.status, startsAt, endsAt })
    const recipients = await prisma.user.findMany({
      where: { campus },
      select: { id: true },
      take: 500,
    })
    const CHUNK = 10
    for (let i = 0; i < recipients.length; i += CHUNK) {
      await Promise.allSettled(
        recipients.slice(i, i + CHUNK).map((u) =>
          createNotification({
            userId: u.id,
            type: "battle_new",
            title: copy.title,
            body: copy.body,
            href: "/battles",
          }).catch(() => null)
        )
      )
    }
  } catch {
    // ignore — battle is created either way
  }

  return NextResponse.json({ prompt })
}