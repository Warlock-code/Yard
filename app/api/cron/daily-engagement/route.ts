import { NextRequest, NextResponse } from "next/server"
import { prisma } from "@/lib/prisma"
import { createNotification } from "@/lib/notifications"
import { battleCountdownText } from "@/lib/battle-countdown"
import { GET as battlesCron } from "@/app/api/cron/battles/route"
import { GET as leaderboardCron } from "@/app/api/cron/leaderboard/route"

export const dynamic = "force-dynamic"

export async function GET(req: NextRequest) {
  const auth = req.headers.get("authorization")
  if (auth !== `Bearer ${process.env.CRON_SECRET}`) {
    return NextResponse.json({ error: "unauthorized." }, { status: 401 })
  }

  const now = Date.now()
  const results: Record<string, unknown> = {}

  // 0. Run battle finalization + board prizes. Those two crons have no
  // Vercel schedule of their own, so they piggyback here daily at 9am
  // ("morning results" ritual). Fully isolated — failures never touch
  // engagement work below. Both are idempotent per period/prompt.
  try {
    const cronReq = () =>
      new NextRequest(new URL("http://localhost/api/cron/piggyback"), {
        headers: { authorization: `Bearer ${process.env.CRON_SECRET}` },
      })
    const [battlesRes, boardsRes] = await Promise.allSettled([battlesCron(cronReq()), leaderboardCron(cronReq())])
    results.battles = battlesRes.status === "fulfilled" ? await battlesRes.value.json().catch(() => ({})) : { error: "failed" }
    results.leaderboards = boardsRes.status === "fulfilled" ? await boardsRes.value.json().catch(() => ({})) : { error: "failed" }
  } catch {
    results.battles = { error: "failed" }
    results.leaderboards = { error: "failed" }
  }

  // 1. Return reminder
  let sent = 0
  try {
    const users = await prisma.user.findMany({
      where: {
        emailVerified: true,
        OR: [
          { lastPostedAt: { lt: new Date(now - 24 * 60 * 60 * 1000) } },
          { lastPostedAt: null },
        ],
        notifications: {
          none: {
            type: "return_reminder",
            createdAt: { gte: new Date(now - 48 * 60 * 60 * 1000) },
          },
        },
      },
      select: { id: true },
      take: 200,
    })

    for (const user of users) {
      void createNotification({
        userId: user.id,
        type: "return_reminder",
        title: "the yard misses you",
        body: "new gist dropped while you were away — check the feed.",
        href: "/feed",
      }).catch(() => {})
      sent += 1
    }
  } catch {
    // ignore
  }

  results.returnReminder = { sent }

  // 2. Generate AI post
  try {
    const recent = await prisma.post.findMany({
      where: { text: { not: null } },
      orderBy: { createdAt: "desc" },
      take: 5,
      select: { text: true },
    })

    const res = await fetch("https://openrouter.ai/api/v1/chat/completions", {
      method: "POST",
      headers: { Authorization: `Bearer ${process.env.OPENROUTER_API_KEY}`, "Content-Type": "application/json" },
      body: JSON.stringify({
        model: "anthropic/claude-3.5-haiku",
        messages: [
          {
            role: "system",
            content: "Write one short, anonymous Ghanaian university campus confession or joke post, under 200 characters, casual student tone. Never mention real people. Respond with only the post text, nothing else.",
          },
          { role: "user", content: `Style examples:\n${recent.map((r) => r.text).join("\n")}` },
        ],
      }),
    })
    const data = await res.json()
    const text = data.choices?.[0]?.message?.content?.trim()

    if (text) {
      await prisma.aiDraft.create({ data: { text: text.toLowerCase() } })
      results.generatePost = { success: true, text }
    } else {
      results.generatePost = { success: false, reason: "No text generated" }
    }
  } catch (e) {
    results.generatePost = { success: false, error: String(e) }
  }

  // 3. Battle countdowns — one reminder per battle per day:
  //    UPCOMING -> "starts in N days", ACTIVE -> "ends in N days".
  //    Deduped per user per battle per day via the notification type.
  let countdownSent = 0
  try {
    const dayStart = new Date(now)
    dayStart.setUTCHours(0, 0, 0, 0)
    const prompts = await prisma.battlePrompt.findMany({
      where: {
        OR: [
          { status: "UPCOMING", startsAt: { gt: new Date(now) } },
          { status: "ACTIVE", endsAt: { gt: new Date(now) } },
        ],
      },
      select: { id: true, text: true, campus: true, status: true, startsAt: true, endsAt: true },
      orderBy: { startsAt: "asc" },
      take: 10,
    })

    for (const prompt of prompts) {
      const copy = battleCountdownText({
        text: prompt.text,
        status: prompt.status,
        startsAt: prompt.startsAt,
        endsAt: prompt.endsAt,
        now: new Date(now),
      })
      if (!copy) continue
      const type = `battle_countdown:${prompt.id}`
      const recipients = await prisma.user.findMany({
        where: {
          campus: prompt.campus,
          notifications: {
            none: { type, createdAt: { gte: dayStart } },
          },
        },
        select: { id: true },
        take: 1000,
      })
      const CHUNK = 10
      for (let i = 0; i < recipients.length; i += CHUNK) {
        await Promise.allSettled(
          recipients.slice(i, i + CHUNK).map((u) =>
            createNotification({
              userId: u.id,
              type,
              title: copy.title,
              body: copy.body,
              href: "/battles",
            }).catch(() => null)
          )
        )
        countdownSent += Math.min(CHUNK, recipients.length - i)
      }
    }
  } catch {
    // ignore
  }

  results.battleCountdowns = { sent: countdownSent }

  return NextResponse.json({ success: true, ...results })
}