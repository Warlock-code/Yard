import { NextRequest, NextResponse } from "next/server"
import { prisma } from "@/lib/prisma"
import { createNotification } from "@/lib/notifications"

export async function GET(req: NextRequest) {
  let sent = 0

  try {
    const auth = req.headers.get("authorization")
    if (auth !== `Bearer ${process.env.CRON_SECRET}`) {
      return NextResponse.json({ error: "Unauthorized." }, { status: 401 })
    }

    const now = Date.now()
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
        title: "The yard misses you",
        body: "New gist dropped while you were away — check the feed.",
        href: "/feed",
      }).catch(() => {})
      sent += 1
    }
  } catch {
    return NextResponse.json({ sent })
  }

  return NextResponse.json({ sent })
}
