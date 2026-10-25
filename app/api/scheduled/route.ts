import { NextRequest, NextResponse } from "next/server"
import { prisma } from "@/lib/prisma"
import { getCurrentUser } from "@/lib/getCurrentUser"
import { getEffectiveTier } from "@/lib/tier"
import { CAMPUSES } from "@/lib/schoolEmails"
import {
  creditUser,
  toCreditErrorResponse,
  trackFeatureEvent,
  CREDIT_CONFIG,
} from "@/lib/credits"

export const dynamic = "force-dynamic"

const PLUS_QUOTA = 5 // PLUS schedules 5 at a time; PRIME unlimited

// Post scheduling — PLUS 5 queued, PRIME unlimited, FREE pays 300cr per 10.
// Queued posts publish via the daily cron. Credits-only.
export async function GET(req: NextRequest) {
  const user = await getCurrentUser(req)
  if (!user) return NextResponse.json({ error: "not authenticated." }, { status: 401 })

  try {
    const queued = await prisma.scheduledPost.findMany({
      where: { userId: user.id, status: "pending" },
      orderBy: { runAt: "asc" },
      take: 50,
    })
    return NextResponse.json({ queued })
  } catch {
    return NextResponse.json({ queued: [] })
  }
}

export async function POST(req: NextRequest) {
  const user = await getCurrentUser(req)
  if (!user) return NextResponse.json({ error: "not authenticated." }, { status: 401 })

  const body = await req.json().catch(() => ({}))
  const text = typeof body.text === "string" ? body.text.trim().toLowerCase() : ""
  const imageUrl = typeof body.imageUrl === "string" ? body.imageUrl.trim() : null
  const type = typeof body.type === "string" ? body.type : "confession"
  const visibility = body.visibility === "program" ? "program" : "school"
  const campusTarget = typeof body.campusTarget === "string" ? body.campusTarget : null
  const runAt = typeof body.runAt === "string" ? new Date(body.runAt) : null

  if (!text && !imageUrl) return NextResponse.json({ error: "post needs text or an image." }, { status: 400 })
  if (text && text.length > 2000) return NextResponse.json({ error: "post text must be 2000 characters or fewer." }, { status: 400 })
  if (!runAt || !Number.isFinite(runAt.getTime()) || runAt.getTime() <= Date.now()) {
    return NextResponse.json({ error: "pick a future time." }, { status: 400 })
  }
  if (runAt.getTime() > Date.now() + 30 * 24 * 60 * 60 * 1000) {
    return NextResponse.json({ error: "schedule at most 30 days out." }, { status: 400 })
  }
  if (campusTarget && campusTarget !== "all" && campusTarget !== user.campus && !CAMPUSES.includes(campusTarget)) {
    return NextResponse.json({ error: "unknown campus." }, { status: 400 })
  }

  const tier = getEffectiveTier(user)
  try {
    const queuedCount = await prisma.scheduledPost.count({
      where: { userId: user.id, status: "pending" },
    })
    if (tier === "FREE") {
      // FREE: 300cr unlocks a 10-slot pack (SCHED_PACK). Each queued post
      // burns one slot (SCHED_USE marker row).
      const [packs, used] = await Promise.all([
        prisma.creditTransaction.count({ where: { userId: user.id, type: "SCHED_PACK" } }),
        prisma.creditTransaction.count({ where: { userId: user.id, type: "SCHED_USE" } }),
      ])
      if (packs * 10 - used <= 0) {
        try {
          await creditUser(user.id, "SCHED_PACK", -CREDIT_CONFIG.SPEND.SCHED_PACK_10, `sched_${user.id}_${Date.now()}`, {})
        } catch (err) {
          return toCreditErrorResponse(err, "scheduling costs 300cr per 10 on free.")
        }
      }
      await prisma.creditTransaction
        .create({
          data: {
            userId: user.id,
            type: "SCHED_USE",
            amount: 0,
            balanceAfter: user.creditsBalance,
            reference: `sched_use_${Date.now()}`,
          },
        })
        .catch(() => null)
    } else if (tier === "PLUS" && queuedCount >= PLUS_QUOTA) {
      return NextResponse.json({ error: "plus holds 5 scheduled posts — upgrade to prime for unlimited." }, { status: 400 })
    }

    const row = await prisma.scheduledPost.create({
      data: { userId: user.id, text: text || null, imageUrl, type, visibility, campusTarget, runAt },
    })
    await trackFeatureEvent({ userId: user.id, type: "schedule_create", metadata: { runAt: runAt.toISOString() } })
    return NextResponse.json({ scheduled: row })
  } catch (err) {
    if (err instanceof Error && "code" in err) throw err
    return NextResponse.json({ error: "couldn't schedule. try again." }, { status: 500 })
  }
}

export async function DELETE(req: NextRequest) {
  const user = await getCurrentUser(req)
  if (!user) return NextResponse.json({ error: "not authenticated." }, { status: 401 })

  const id = new URL(req.url).searchParams.get("id")
  if (!id) return NextResponse.json({ error: "id required." }, { status: 400 })

  try {
    await prisma.scheduledPost.updateMany({
      where: { id, userId: user.id, status: "pending" },
      data: { status: "cancelled" },
    })
    return NextResponse.json({ success: true })
  } catch {
    return NextResponse.json({ error: "couldn't cancel." }, { status: 500 })
  }
}
