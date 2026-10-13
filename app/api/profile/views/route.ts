import { NextRequest, NextResponse } from "next/server"
import { prisma } from "@/lib/prisma"
import { getCurrentUser } from "@/lib/getCurrentUser"
import { getEffectiveTier } from "@/lib/tier"

export const dynamic = "force-dynamic"

// Who viewed my profile — PLUS/PRIME only (curiosity drives upgrades).
// Views are recorded for every ghost, but only paying tiers can read them.
// Viewer list shows public ghost identity only (ghostId + avatar + tier) —
// never anything de-anonymizing.
export async function GET(req: NextRequest) {
  const user = await getCurrentUser(req)
  if (!user) return NextResponse.json({ error: "not authenticated." }, { status: 401 })

  if (getEffectiveTier(user) === "FREE") {
    return NextResponse.json(
      { error: "profile views are plus exclusive — upgrade to see who's lurking.", upgrade: true },
      { status: 403 }
    )
  }

  try {
    const since = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000)
    const views = await prisma.profileView.findMany({
      where: { viewedId: user.id, createdAt: { gte: since } },
      orderBy: { createdAt: "desc" },
      take: 50,
      select: { viewerId: true, createdAt: true },
    })
    const viewers = await prisma.user.findMany({
      where: { id: { in: [...new Set(views.map((v) => v.viewerId))] } },
      select: { id: true, ghostId: true, avatarEmoji: true, tier: true },
    })
    const byId = new Map(viewers.map((v) => [v.id, v]))
    return NextResponse.json({
      views: views
        .map((v) => {
          const u = byId.get(v.viewerId)
          if (!u) return null
          return { ghostId: u.ghostId, avatarEmoji: u.avatarEmoji, tier: u.tier, viewedAt: v.createdAt }
        })
        .filter(Boolean),
    })
  } catch {
    return NextResponse.json({ views: [] })
  }
}
