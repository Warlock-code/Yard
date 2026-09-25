import { NextRequest, NextResponse } from "next/server"
import { prisma } from "@/lib/prisma"
import { getCurrentUser } from "@/lib/getCurrentUser"
import { getTreasuryStats, mintCreditsAdmin, burnCreditsAdmin } from "@/lib/credits"

export async function GET(req: NextRequest) {
  const user = await getCurrentUser(req)
  if (!user || user.tier !== "PRIME") {
    return NextResponse.json({ error: "Admin only" }, { status: 403 })
  }

  const { searchParams } = new URL(req.url)
  const action = searchParams.get("action")

  if (action === "treasury") {
    const stats = await getTreasuryStats()
    return NextResponse.json({ stats })
  }

  if (action === "payouts") {
    const status = searchParams.get("status") || "pending"
    const payouts = await prisma.creditPayout.findMany({
      where: { status: { in: status.split(",") } },
      include: { user: { select: { ghostId: true, email: true, tier: true } } },
      orderBy: { requestedAt: "desc" },
      take: 100,
    })
    return NextResponse.json({ payouts })
  }

  if (action === "users") {
    const users = await prisma.user.findMany({
      where: { creditsBalance: { gt: 0 } },
      select: {
        id: true,
        ghostId: true,
        email: true,
        tier: true,
        creditsBalance: true,
        creditsEarned: true,
        creditsPurchased: true,
        creditsWithdrawn: true,
        kycStatus: true,
        createdAt: true,
      },
      orderBy: { creditsBalance: "desc" },
      take: 100,
    })
    return NextResponse.json({ users })
  }

  return NextResponse.json({ error: "Invalid action" }, { status: 400 })
}

export async function POST(req: NextRequest) {
  const user = await getCurrentUser(req)
  if (!user || user.tier !== "PRIME") {
    return NextResponse.json({ error: "Admin only" }, { status: 403 })
  }

  const body = await req.json().catch(() => ({}))
  const { action } = body

  if (action === "mint") {
    const { userId, amount, reason } = body
    if (!userId || !amount || !reason) {
      return NextResponse.json({ error: "userId, amount, reason required" }, { status: 400 })
    }
    const result = await mintCreditsAdmin(userId, amount, reason, user.id)
    return NextResponse.json({ success: true, ...result })
  }

  if (action === "burn") {
    const { userId, amount, reason } = body
    if (!userId || !amount || !reason) {
      return NextResponse.json({ error: "userId, amount, reason required" }, { status: 400 })
    }
    const result = await burnCreditsAdmin(userId, amount, reason, user.id)
    return NextResponse.json({ success: true, ...result })
  }

  if (action === "approve_payout") {
    const { payoutId } = body
    if (!payoutId) return NextResponse.json({ error: "payoutId required" }, { status: 400 })

    const payout = await prisma.creditPayout.findUnique({ where: { id: payoutId } })
    if (!payout) return NextResponse.json({ error: "Payout not found" }, { status: 404 })
    if (payout.status !== "pending") return NextResponse.json({ error: "Already processed" }, { status: 400 })

    await prisma.creditPayout.update({
      where: { id: payoutId },
      data: { status: "approved", adminNotes: body.notes },
    })

    return NextResponse.json({ success: true })
  }

  if (action === "reject_payout") {
    const { payoutId, reason } = body
    if (!payoutId) return NextResponse.json({ error: "payoutId required" }, { status: 400 })

    const payout = await prisma.creditPayout.findUnique({ where: { id: payoutId } })
    if (!payout) return NextResponse.json({ error: "Payout not found" }, { status: 404 })

    // Refund credits to user
    await mintCreditsAdmin(payout.userId, payout.creditsAmount, `Payout rejected: ${reason || "Admin rejection"}`, user.id)

    await prisma.creditPayout.update({
      where: { id: payoutId },
      data: { status: "rejected", adminNotes: reason || "Rejected by admin" },
    })

    return NextResponse.json({ success: true })
  }

  return NextResponse.json({ error: "Invalid action" }, { status: 400 })
}