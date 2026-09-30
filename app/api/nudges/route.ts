import { NextRequest, NextResponse } from "next/server"
import { prisma } from "@/lib/prisma"
import { getCurrentUser } from "@/lib/getCurrentUser"
import { evalUserNudges } from "@/lib/nudges"

export const dynamic = "force-dynamic"

/**
 * GET /api/nudges — Snapchat-style on-demand eval.
 * Evaluates slow-burn nudges (streak/storage/plus/first-buy/name/avatar/comeback)
 * then returns the user's recent unread nudges for inline display.
 */
export async function GET(req: NextRequest) {
  const user = await getCurrentUser(req)
  if (!user) return NextResponse.json({ error: "not authenticated." }, { status: 401 })

  // Fire evaluations (capped at 2 creates per call inside evalUserNudges)
  await evalUserNudges(user.id).catch(() => {})

  const nudges = await prisma.notification.findMany({
    where: {
      userId: user.id,
      type: { startsWith: "nudge_" },
      readAt: null,
    },
    orderBy: { createdAt: "desc" },
    take: 5,
    select: { id: true, type: true, title: true, body: true, href: true, createdAt: true },
  })

  return NextResponse.json({ nudges }, { headers: { "Cache-Control": "private, no-store" } })
}
