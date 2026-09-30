import { NextRequest, NextResponse } from "next/server"
import { getCurrentUser } from "@/lib/getCurrentUser"

export async function POST(req: NextRequest) {
  const user = await getCurrentUser(req)
  if (!user) return NextResponse.json({ error: "not authenticated." }, { status: 401 })

  // GHS payouts are paused (Prime tier removed, withdrawals disabled).
  // Previous payout logic kept in git history (`git log -- app/api/payouts/route.ts`)
  // — restore it here when payouts reopen, gated on the new top tier.
  return NextResponse.json({ error: "payouts are currently disabled." }, { status: 403 })
}
