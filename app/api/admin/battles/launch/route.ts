import { NextRequest, NextResponse } from "next/server"
import { prisma } from "@/lib/prisma"
import { isAdmin } from "@/lib/getAdmin"
import { createNotification } from "@/lib/notifications"
import { BATTLE_DURATION_MS, newBattleText } from "@/lib/battle-countdown"

export const dynamic = "force-dynamic"
export const revalidate = 0
export const fetchCache = "force-no-store"

// Launch a dormant draft NOW: startsAt = now, ACTIVE, campus notified.
// Every launched battle runs for exactly 72 hours (3 days).
export async function POST(req: NextRequest) {
  if (!isAdmin(req)) {
    return NextResponse.json({ error: "not authorized." }, { status: 403 })
  }
  const { id } = await req.json()
  if (!id) return NextResponse.json({ error: "id required." }, { status: 400 })

  const draft = await prisma.battlePrompt.findUnique({ where: { id } })
  if (!draft) return NextResponse.json({ error: "draft not found." }, { status: 404 })
  if (draft.status !== "UPCOMING") {
    return NextResponse.json({ error: "only upcoming drafts can launch." }, { status: 400 })
  }

  const now = new Date()
  const prompt = await prisma.battlePrompt.update({
    where: { id },
    data: {
      status: "ACTIVE",
      startsAt: now,
      endsAt: new Date(now.getTime() + BATTLE_DURATION_MS),
    },
  })

  // Same instant alert as battle creation. Capped + chunked, failures never
  // fail the launch.
  try {
    const copy = newBattleText({ text: prompt.text, status: prompt.status, startsAt: now, endsAt: prompt.endsAt })
    const recipients = await prisma.user.findMany({
      where: { campus: prompt.campus },
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
    // ignore — battle is live either way
  }

  return NextResponse.json({ prompt })
}
