import { NextRequest, NextResponse } from "next/server"
import { prisma } from "@/lib/prisma"

export const dynamic = "force-dynamic"

export async function GET(req: NextRequest) {
  const auth = req.headers.get("authorization")
  if (auth !== `Bearer ${process.env.CRON_SECRET}`) {
    return NextResponse.json({ error: "Unauthorized." }, { status: 401 })
  }

  const now = new Date()
  // Grace period: 3 days after expiry before hard downgrade
  const graceCutoff = new Date(now.getTime() - 3 * 24 * 60 * 60 * 1000)

  // Find users whose tier expired beyond grace
  const expiredUsers = await prisma.user.findMany({
    where: { tier: { not: "FREE" }, tierExpiresAt: { lte: graceCutoff } },
    select: { id: true, tier: true, tierExpiresAt: true, email: true },
  })

  let downgraded = 0
  for (const u of expiredUsers) {
    await prisma.user.update({
      where: { id: u.id },
      data: { tier: "FREE", tierExpiresAt: null },
    })
    // Notify user their tier expired
    try {
      await prisma.notification.create({
        data: {
          userId: u.id,
          type: "tier_expired",
          title: "Your Yard tier ended",
          body: `Your ${u.tier} expired. Renew at yardapp.me/upgrade to keep Prime perks & payouts.`,
          href: "/upgrade",
        },
      })
    } catch {}
    downgraded++
  }

  // Also find soon-expiring (within 3 days) to send reminder (without downgrade)
  const soonExpiring = await prisma.user.findMany({
    where: {
      tier: { not: "FREE" },
      tierExpiresAt: { gte: now, lte: new Date(now.getTime() + 3 * 24 * 60 * 60 * 1000) },
    },
    select: { id: true },
  })

  return NextResponse.json({ downgraded, soonExpiring: soonExpiring.length, checkedAt: now })
}
