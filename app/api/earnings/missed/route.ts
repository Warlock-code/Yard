import { NextRequest, NextResponse } from "next/server"
import { getCurrentUser } from "@/lib/getCurrentUser"
import { getMissedSince, getMissedTotal } from "@/lib/missedEarnings"

export const dynamic = "force-dynamic"

/**
 * GET /api/earnings/missed — FREE upgrade nudge numbers.
 * Returns lifetime + last-7d shadow earnings (PLUS 1x basis).
 * PRIME would have earned ~2x weekly. Live-safe: 0s pre-migration.
 */
export async function GET(req: NextRequest) {
  const user = await getCurrentUser(req)
  if (!user) return NextResponse.json({ error: "not authenticated." }, { status: 401 })

  const weekAgo = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000)
  const [total, weekly] = await Promise.all([
    getMissedTotal(user.id).catch(() => 0),
    getMissedSince(user.id, weekAgo).catch(() => 0),
  ])

  return NextResponse.json(
    {
      total,
      weekly,
      plusWeekly: weekly,
      primeWeekly: weekly * 2,
      plusTotal: total,
      primeTotal: total * 2,
    },
    { headers: { "Cache-Control": "private, no-store" } }
  )
}
