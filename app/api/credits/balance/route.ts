import { NextRequest, NextResponse } from "next/server"
import { prisma } from "@/lib/prisma"
import { getCurrentUser } from "@/lib/getCurrentUser"
import { getUserCredits, getCreditTransactions, getAllPacks } from "@/lib/credits"

export async function GET(req: NextRequest) {
  const user = await getCurrentUser(req)
  if (!user) return NextResponse.json({ error: "not authenticated." }, { status: 401 })

  // Analytics beacon — live-safe, never breaks the main flow.
  try {
    await prisma.analyticsEvent.create({
      data: { userId: user.id, type: "wallet_view", pathname: "/lair/wallet" },
    }).catch(() => {})
  } catch {}

  const [credits, { transactions }, packs] = await Promise.all([
    getUserCredits(user.id),
    getCreditTransactions(user.id, 20),
    getAllPacks(),
  ])

  return NextResponse.json({
    balance: credits?.creditsBalance || 0,
    earned: credits?.creditsEarned || 0,
    purchased: credits?.creditsPurchased || 0,
    transactions,
    packs,
  })
}