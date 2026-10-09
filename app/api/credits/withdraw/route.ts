import { NextRequest, NextResponse } from "next/server"
import { getCurrentUser } from "@/lib/getCurrentUser"
import { getUserCredits } from "@/lib/credits"

export async function GET(req: NextRequest) {
  const user = await getCurrentUser(req)
  if (!user) return NextResponse.json({ error: "not authenticated." }, { status: 401 })

  const credits = await getUserCredits(user.id)
  return NextResponse.json({ credits })
}

export async function POST() {
  // No cash-out: credits are in-app only and can never be withdrawn or
  // redeemed for cash. The payout engine stays dormant in git history
  // (`git log -- app/api/credits/withdraw/route.ts`) until cleared by counsel.
  return NextResponse.json({ error: "withdrawals are not available. credits are spendable in-app." }, { status: 410 })
}
