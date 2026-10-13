import { NextRequest, NextResponse } from "next/server"
import { prisma } from "@/lib/prisma"
import { getCurrentUser } from "@/lib/getCurrentUser"
import { getCreditTransactions } from "@/lib/credits"

export async function GET(req: NextRequest) {
  const user = await getCurrentUser(req)
  if (!user) return NextResponse.json({ error: "not authenticated." }, { status: 401 })

  // Analytics beacon — live-safe, never breaks the main flow.
  try {
    await prisma.analyticsEvent.create({
      data: { userId: user.id, type: "wallet_view", pathname: "/lair/wallet" },
    }).catch(() => {})
  } catch {}

  const { searchParams } = new URL(req.url)
  const cursor = searchParams.get("cursor")
  const limit = parseInt(searchParams.get("limit") || "50")

  const { transactions, nextCursor } = await getCreditTransactions(user.id, limit, cursor || undefined)

  return NextResponse.json({ transactions, nextCursor })
}