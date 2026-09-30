import { NextRequest, NextResponse } from "next/server"
import { prisma } from "@/lib/prisma"
import { isAdmin } from "@/lib/getAdmin"

const VALID_CAMPUSES = ["University of Ghana", "KNUST", "UCC", "GCTU", "UPSA"]

export const dynamic = "force-dynamic"
export const revalidate = 0
export const fetchCache = "force-no-store"

export async function POST(req: NextRequest) {
  if (!isAdmin(req)) {
    return NextResponse.json({ error: "Not authorized." }, { status: 403 })
  }

  const {
    text,
    campus,
    durationHours,
    type = "SINGLE",
    totalRounds = 1,
    entryType = "TEXT",
    schedule = "once",
    scheduleTime,
    scheduleDays,
    seasonId,
  } = await req.json()

  if (!text?.trim() || !campus) {
    return NextResponse.json({ error: "Prompt text and campus required." }, { status: 400 })
  }
  if (!VALID_CAMPUSES.includes(campus)) {
    return NextResponse.json({ error: "Invalid campus." }, { status: 400 })
  }

  const now = new Date()
  const startsAt = scheduleTime ? new Date(scheduleTime) : now
  const endsAt = new Date(startsAt.getTime() + (durationHours || 24) * 60 * 60 * 1000)

  let season: { id: string } | null = null
  if (seasonId) {
    season = await prisma.battleSeason.findUnique({ where: { id: seasonId }, select: { id: true } })
    if (!season) {
      return NextResponse.json({ error: "Season not found." }, { status: 400 })
    }
  }

  if (type === "BRACKET" && totalRounds < 2) {
    return NextResponse.json({ error: "Bracket battles need at least 2 rounds." }, { status: 400 })
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
      durationHours,
      schedule,
      scheduleTime,
      scheduleDays,
      seasonId,
    }
    // Schedule handling would go here (e.g., using external cron service)
    console.log("Scheduled battle:", scheduleData)
  }

  return NextResponse.json({ prompt })
}