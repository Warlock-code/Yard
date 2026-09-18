import { NextRequest, NextResponse } from "next/server"
import { prisma } from "@/lib/prisma"

export const dynamic = "force-dynamic"

export async function GET(req: NextRequest) {
  const auth = req.headers.get("authorization")
  if (auth !== `Bearer ${process.env.CRON_SECRET}`) {
    return NextResponse.json({ error: "Unauthorized." }, { status: 401 })
  }

  const now = new Date()
  const scheduledDrafts = await prisma.aiDraft.findMany({
    where: { status: "scheduled_battle" },
  })

  const created: string[] = []
  const errors: string[] = []

  for (const draft of scheduledDrafts) {
    try {
      const scheduleData = JSON.parse(draft.text)
      const { campus, text, type, totalRounds, isPrimeOnly, earlyAccessForPrime, entryType, durationHours, schedule, scheduleTime, scheduleDays, seasonId } = scheduleData

      let nextStart: Date
      const scheduleTimeDate = new Date(scheduleTime)
      const today = new Date()
      today.setHours(scheduleTimeDate.getHours(), scheduleTimeDate.getMinutes(), 0, 0)

      if (today <= now) {
        if (schedule === "daily") {
          nextStart = new Date(today.getTime() + 24 * 60 * 60 * 1000)
        } else if (schedule === "weekly") {
          nextStart = new Date(today.getTime() + 7 * 24 * 60 * 60 * 1000)
        } else {
          continue
        }
      } else {
        nextStart = today
      }

      const dayOfWeek = nextStart.getDay()
      if (!scheduleDays.includes(dayOfWeek)) {
        continue
      }

      const nextEnd = new Date(nextStart.getTime() + durationHours * 60 * 60 * 1000)

      await prisma.battlePrompt.create({
        data: {
          text,
          campus,
          type,
          status: "UPCOMING",
          startsAt: nextStart,
          endsAt: nextEnd,
          totalRounds,
          roundNumber: 1,
          isPrimeOnly,
          earlyAccessForPrime,
          entryType,
          seasonId,
        },
      })

      await prisma.aiDraft.update({
        where: { id: draft.id },
        data: { text: JSON.stringify({ ...scheduleData, scheduleTime: nextStart.toISOString() }) },
      })

      created.push(`${campus} - ${text.slice(0, 30)}... at ${nextStart.toISOString()}`)
    } catch (err) {
      errors.push(`${draft.id}: ${err instanceof Error ? err.message : "Unknown error"}`)
    }
  }

  const upcomingPrompts = await prisma.battlePrompt.findMany({
    where: { status: "UPCOMING", startsAt: { lte: now } },
  })

  for (const prompt of upcomingPrompts) {
    await prisma.battlePrompt.update({
      where: { id: prompt.id },
      data: { status: "ACTIVE" },
    })
  }

  const activePrompts = await prisma.battlePrompt.findMany({
    where: { status: "ACTIVE", endsAt: { lte: now } },
  })

  for (const prompt of activePrompts) {
    if (prompt.type === "BRACKET" && prompt.roundNumber < prompt.totalRounds) {
      const entries = await prisma.battleEntry.findMany({
        where: { promptId: prompt.id },
        orderBy: { votes: "desc" },
      })

      if (entries.length >= 2) {
        const winners = entries.slice(0, Math.ceil(entries.length / 2))
        const winnerIds = winners.map(e => e.id)

        await prisma.battleEntry.updateMany({
          where: { id: { in: winnerIds } },
          data: { wonRound: true },
        })

        const nextRoundPrompt = await prisma.battlePrompt.create({
          data: {
            text: `${prompt.text} (Round ${prompt.roundNumber + 1})`,
            campus: prompt.campus,
            type: "BRACKET",
            status: "ACTIVE",
            startsAt: now,
            endsAt: new Date(now.getTime() + (prompt.endsAt.getTime() - prompt.startsAt.getTime())),
            totalRounds: prompt.totalRounds,
            roundNumber: prompt.roundNumber + 1,
            parentPromptId: prompt.id,
            isPrimeOnly: prompt.isPrimeOnly,
            earlyAccessForPrime: prompt.earlyAccessForPrime,
            entryType: prompt.entryType,
            seasonId: prompt.seasonId,
          },
        })

        await prisma.battlePrompt.update({
          where: { id: prompt.id },
          data: { status: "COMPLETED" },
        })

        await createNotificationsForRoundStart(nextRoundPrompt, winners)
      } else {
        await prisma.battlePrompt.update({
          where: { id: prompt.id },
          data: { status: "COMPLETED" },
        })
      }
    } else {
      const winner = await prisma.battleEntry.findFirst({
        where: { promptId: prompt.id },
        orderBy: { votes: "desc" },
        include: { prompt: { select: { id: true, text: true, campus: true } } },
      })

      if (winner) {
        await prisma.battlePrompt.update({
          where: { id: prompt.id },
          data: { status: "COMPLETED", winnerEntryId: winner.id },
        })

        await prisma.battleEntry.update({
          where: { id: winner.id },
          data: { wonRound: true },
        })

        await updateBattleStats(winner.userId, true)
        await createWinNotification(winner)

        for (const entry of await prisma.battleEntry.findMany({ where: { promptId: prompt.id, userId: { not: winner.userId } } })) {
          await updateBattleStats(entry.userId, false)
        }
      } else {
        await prisma.battlePrompt.update({
          where: { id: prompt.id },
          data: { status: "COMPLETED" },
        })
      }
    }
  }

  const votingPrompts = await prisma.battlePrompt.findMany({
    where: { status: "VOTING", endsAt: { lte: now } },
  })

  for (const prompt of votingPrompts) {
    const winner = await prisma.battleEntry.findFirst({
      where: { promptId: prompt.id },
      orderBy: { votes: "desc" },
      include: { prompt: { select: { id: true, text: true, campus: true } } },
    })

    if (winner) {
      await prisma.battlePrompt.update({
        where: { id: prompt.id },
        data: { status: "COMPLETED", winnerEntryId: winner.id },
      })
      await createWinNotification(winner)
    }
  }

  const tenMinutesFromNow = new Date(now.getTime() + 10 * 60 * 1000)
  const startingSoon = await prisma.battlePrompt.findMany({
    where: { status: "UPCOMING", startsAt: { gte: now, lte: tenMinutesFromNow } },
  })

  for (const prompt of startingSoon) {
    await createStartingSoonNotifications(prompt)
  }

  return NextResponse.json({ created, errors, processed: scheduledDrafts.length })
}

async function createNotificationsForRoundStart(prompt: { id: string; text: string; campus: string; roundNumber: number }, winners: { id: string; userId: string }[]) {
  const winnerUserIds = winners.map(w => w.userId)
  const users = await prisma.user.findMany({
    where: { id: { in: winnerUserIds }, campus: prompt.campus },
    select: { id: true, pushToken: true, deviceTokens: { select: { token: true } } },
  })

  for (const user of users) {
    const tokens = new Set([
      ...user.deviceTokens.map(d => d.token),
      user.pushToken,
    ].filter((t): t is string => Boolean(t)))

    for (const token of tokens) {
      await fetch(`${process.env.NEXT_PUBLIC_APP_URL}/api/notifications/send`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          token,
          title: `Round ${prompt.roundNumber} Starting!`,
          body: `Your entry advanced! "${prompt.text}"`,
          href: `/battles/${prompt.id}`,
        }),
      })
    }
  }
}

async function createStartingSoonNotifications(prompt: { id: string; text: string; campus: string }) {
  const users = await prisma.user.findMany({
    where: { campus: prompt.campus },
    select: { id: true, pushToken: true, deviceTokens: { select: { token: true } } },
  })

  for (const user of users) {
    const tokens = new Set([
      ...user.deviceTokens.map(d => d.token),
      user.pushToken,
    ].filter((t): t is string => Boolean(t)))

    for (const token of tokens) {
      await fetch(`${process.env.NEXT_PUBLIC_APP_URL}/api/notifications/send`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          token,
          title: "Battle Starting Soon!",
          body: `"${prompt.text}" starts in 10 minutes. Get ready!`,
          href: `/battles/${prompt.id}`,
        }),
      })
    }
  }
}

async function createWinNotification(winner: { id: string; userId: string; text: string | null; prompt: { id: string; text: string; campus: string } }) {
  const user = await prisma.user.findUnique({
    where: { id: winner.userId },
    select: { pushToken: true, deviceTokens: { select: { token: true } } },
  })

  if (!user) return

  const tokens = new Set([
    ...user.deviceTokens.map(d => d.token),
    user.pushToken,
  ].filter((t): t is string => Boolean(t)))

  for (const token of tokens) {
    await fetch(`${process.env.NEXT_PUBLIC_APP_URL}/api/notifications/send`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        token,
        title: "🏆 You Won the Battle!",
        body: `Your entry "${winner.text?.slice(0, 50)}..." won!`,
        href: `/battles/${winner.prompt.id}`,
      }),
    })
  }
}

async function updateBattleStats(userId: string, won: boolean) {
  await prisma.battleStats.upsert({
    where: { userId },
    create: {
      userId,
      totalBattles: 1,
      totalEntries: 1,
      totalWins: won ? 1 : 0,
      winRate: won ? 100 : 0,
      currentStreak: won ? 1 : 0,
      bestStreak: won ? 1 : 0,
      lastBattleAt: new Date(),
    },
    update: {
      totalBattles: { increment: 1 },
      totalEntries: { increment: 1 },
      totalWins: { increment: won ? 1 : 0 },
      currentStreak: won ? { increment: 1 } : 0,
      bestStreak: won ? { increment: 1 } : { increment: 0 },
      winRate: won
        ? { increment: (100 - 0) / 1 }
        : { decrement: 0 },
      lastBattleAt: new Date(),
    },
  })
}