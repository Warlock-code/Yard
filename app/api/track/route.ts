import { NextRequest, NextResponse } from "next/server"
import { prisma } from "@/lib/prisma"
import { getCurrentUser } from "@/lib/getCurrentUser"

export const dynamic = "force-dynamic"

// Live-safe usage beacon. Never throws to the client — always 200 with { ok }.
// Tables may not exist until migration 20261005120000 is deployed, so every
// DB write is try/caught. Old app versions that never call this keep working.
export async function POST(req: NextRequest) {
  try {
    let body: { type?: string; sessionId?: string; pathname?: string; durationSec?: number } = {}
    try {
      body = (await req.json()) as typeof body
    } catch {
      return NextResponse.json({ ok: true })
    }

    const type = typeof body.type === "string" ? body.type.slice(0, 32) : ""
    if (!["session_start", "heartbeat", "session_end", "page_view"].includes(type)) {
      return NextResponse.json({ ok: true })
    }

    const pathname =
      typeof body.pathname === "string" ? body.pathname.slice(0, 200) : null
    const increment =
      typeof body.durationSec === "number" && Number.isFinite(body.durationSec)
        ? Math.max(0, Math.min(300, Math.floor(body.durationSec)))
        : type === "heartbeat"
          ? 30
          : 0

    let userId: string | null = null
    try {
      const user = await getCurrentUser(req)
      userId = user?.id ?? null
    } catch {
      userId = null
    }

    const ua = req.headers.get("user-agent") || ""
    const platform = ua.includes("Android")
      ? "android"
      : ua.includes("iPhone") || ua.includes("iPad")
        ? "ios"
        : "web"

    if (type === "session_start") {
      try {
        const session = await prisma.userSession.create({
          data: { userId, platform, pathname },
          select: { id: true },
        })
        return NextResponse.json({ ok: true, sessionId: session.id })
      } catch {
        return NextResponse.json({ ok: true })
      }
    }

    if (type === "page_view") {
      try {
        await prisma.analyticsEvent.create({
          data: { userId, type: "page_view", pathname, metadata: { platform } },
        })
      } catch {
        // table missing — ignore
      }
      return NextResponse.json({ ok: true })
    }

    // heartbeat / session_end — needs a sessionId
    const sessionId = typeof body.sessionId === "string" ? body.sessionId.slice(0, 64) : ""
    if (!sessionId) return NextResponse.json({ ok: true })

    try {
      if (type === "heartbeat") {
        await prisma.userSession.updateMany({
          where: { id: sessionId },
          data: {
            endedAt: new Date(),
            durationSec: { increment },
            ...(userId ? { userId } : {}),
          },
        })
      } else {
        await prisma.userSession.updateMany({
          where: { id: sessionId },
          data: {
            endedAt: new Date(),
            ...(increment > 0 ? { durationSec: { increment } } : {}),
            ...(userId ? { userId } : {}),
          },
        })
      }
    } catch {
      // missing table or stale session — ignore
    }
    return NextResponse.json({ ok: true })
  } catch {
    return NextResponse.json({ ok: true })
  }
}
