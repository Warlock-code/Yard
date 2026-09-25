import { NextRequest, NextResponse } from "next/server"
import { getCurrentUser } from "@/lib/getCurrentUser"
import { getCreditTransactions, getCreditPayouts } from "@/lib/credits"

export async function GET(req: NextRequest) {
  const user = await getCurrentUser(req)
  if (!user) return NextResponse.json({ error: "Not authenticated." }, { status: 401 })

  const { searchParams } = new URL(req.url)
  const cursor = searchParams.get("cursor")
  const limit = parseInt(searchParams.get("limit") || "50")

  const { transactions, nextCursor } = await getCreditTransactions(user.id, limit, cursor || undefined)
  const payouts = await getCreditPayouts(user.id)

  return NextResponse.json({ transactions, payouts, nextCursor })
}