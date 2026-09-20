import { NextRequest, NextResponse } from "next/server"
import { prisma } from "@/lib/prisma"
import { getMaxBoostExpiry } from "@/lib/boost"

export const dynamic = "force-dynamic"

/**
 * Clears expired 24h boosts so they re-rank as normal posts
 * and lose the "Boosted" tag everywhere.
 * - boosted=true + boostedUntil <= now (or null) -> boosted=false, boostedUntil=null
 * - boosted=true + boostedUntil > now+24h (bad seeds) -> capped to now+24h
 * Idempotent; runs daily (Hobby cron limit). Intraday expiry needs no
 * cron: feed/search/trending/profile all recompute the tag from
 * `boostedUntil`, so expired boosts drop off the moment they lapse.
 */
export async function GET(req: NextRequest) {
  const auth = req.headers.get("authorization")
  if (auth !== `Bearer ${process.env.CRON_SECRET}`) {
    return NextResponse.json({ error: "Unauthorized." }, { status: 401 })
  }

  const now = new Date()
  const maxExpiry = getMaxBoostExpiry(now)

  const expired = await prisma.post.updateMany({
    where: {
      boosted: true,
      OR: [{ boostedUntil: { lte: now } }, { boostedUntil: null }],
    },
    data: { boosted: false, boostedUntil: null },
  })

  const capped = await prisma.post.updateMany({
    where: {
      boosted: true,
      boostedUntil: { gt: maxExpiry },
    },
    data: { boostedUntil: maxExpiry },
  })

  return NextResponse.json({
    expired: expired.count,
    capped: capped.count,
    checkedAt: now,
  })
}
