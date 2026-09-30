import { NextRequest, NextResponse } from "next/server"
import { prisma } from "@/lib/prisma"
import { createNotification } from "@/lib/notifications"

export const dynamic = "force-dynamic"

export async function GET(req: NextRequest) {
  const auth = req.headers.get("authorization")
  if (auth !== `Bearer ${process.env.CRON_SECRET}`) {
    return NextResponse.json({ error: "unauthorized." }, { status: 401 })
  }

  const now = Date.now()
  const results: Record<string, unknown> = {}

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

  return NextResponse.json({ success: true, ...results })
}