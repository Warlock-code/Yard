import { NextRequest, NextResponse } from "next/server"
import { prisma } from "@/lib/prisma"
import { getCurrentUser } from "@/lib/getCurrentUser"
import {
  creditUser,
  toCreditErrorResponse,
  trackFeatureEvent,
  CREDIT_CONFIG,
} from "@/lib/credits"

export const dynamic = "force-dynamic"

const PASS_MS = 7 * 24 * 60 * 60 * 1000

// Ghost name history reveal — gossip gold, fully anonymous (ghost names are
// already public). 200cr per reveal, or 1,000cr for unlimited 7 days.
// History is rebuilt from rename transactions — no new tables.
export async function POST(req: NextRequest) {
  const user = await getCurrentUser(req)
  if (!user) return NextResponse.json({ error: "not authenticated." }, { status: 401 })

  const body = await req.json().catch(() => ({}))
  const ghostId = typeof body.ghostId === "string" ? body.ghostId.trim().toLowerCase() : ""
  if (!ghostId) return NextResponse.json({ error: "ghost required." }, { status: 400 })
  if (ghostId === user.ghostId.toLowerCase()) {
    return NextResponse.json({ error: "that's you — check your own history in the lair." }, { status: 400 })
  }

  const target = await prisma.user.findUnique({
    where: { ghostId },
    select: { id: true, ghostId: true, avatarEmoji: true, campus: true },
  })
  if (!target || target.campus !== user.campus) {
    return NextResponse.json({ error: "ghost not found." }, { status: 404 })
  }

  // Unlimited pass? A NAME_PASS txn within 7 days covers all reveals.
  let unlimitedUntil: Date | null = null
  try {
    const pass = await prisma.creditTransaction.findFirst({
      where: {
        userId: user.id,
        type: "NAME_PASS",
        createdAt: { gte: new Date(Date.now() - PASS_MS) },
      },
      orderBy: { createdAt: "desc" },
      select: { createdAt: true },
    })
    if (pass) unlimitedUntil = new Date(pass.createdAt.getTime() + PASS_MS)
  } catch {
    unlimitedUntil = null
  }

  if (!unlimitedUntil) {
    try {
      await creditUser(user.id, "NAME_REVEAL", -CREDIT_CONFIG.SPEND.NAME_REVEAL, `reveal_${user.id}_${target.id}_${Date.now()}`, {
        ghostId: target.ghostId,
      })
    } catch (err) {
      return toCreditErrorResponse(err, "reveals cost 200cr.")
    }
  }

  // Rebuild known previous names from rename history (oldest → newest).
  let history: string[] = []
  try {
    const renames = await prisma.creditTransaction.findMany({
      where: { userId: target.id, type: { in: ["CUSTOM_NAME"] } },
      orderBy: { createdAt: "asc" },
      take: 100,
      select: { metadata: true },
    })
    const seen = new Set<string>()
    for (const r of renames) {
      const m = r.metadata as { oldName?: unknown; newName?: unknown } | null
      for (const key of ["oldName", "newName"] as const) {
        const v = m?.[key]
        if (typeof v === "string" && v && v !== target.ghostId && !seen.has(v)) {
          seen.add(v)
          history.push(v)
        }
      }
    }
  } catch {
    history = []
  }

  await trackFeatureEvent({
    userId: user.id,
    type: "name_reveal",
    metadata: { ghostId: target.ghostId, unlimited: !!unlimitedUntil },
  })

  return NextResponse.json({
    ghostId: target.ghostId,
    avatarEmoji: target.avatarEmoji,
    history,
    historyNote: history.length === 0 ? "no known previous names." : undefined,
    unlimitedUntil,
  })
}
