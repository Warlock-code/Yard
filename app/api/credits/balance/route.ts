import { NextRequest, NextResponse } from "next/server"
import { getCurrentUser } from "@/lib/getCurrentUser"
import { getUserCredits, getCreditTransactions, getCreditPayouts, getAllPacks } from "@/lib/credits"

export async function GET(req: NextRequest) {
  const user = await getCurrentUser(req)
  if (!user) return NextResponse.json({ error: "Not authenticated." }, { status: 401 })

  const [credits, { transactions }, payouts, packs] = await Promise.all([
    getUserCredits(user.id),
    getCreditTransactions(user.id, 20),
    getCreditPayouts(user.id),
    getAllPacks(),
  ])

  return NextResponse.json({
    balance: credits?.creditsBalance || 0,
    earned: credits?.creditsEarned || 0,
    purchased: credits?.creditsPurchased || 0,
    withdrawn: credits?.creditsWithdrawn || 0,
    transactions,
    payouts,
    packs,
  })
}