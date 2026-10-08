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
  // Withdrawals paused pending licensing/KYC review — fail closed.
  // GET (balance view) still works; no new cash-out can be created and no
  // bank details are collected while paused. Original logic kept in git
  // history (`git log -- app/api/credits/withdraw/route.ts`) — restore it
  // here once cleared by counsel.
  return NextResponse.json({ error: "withdrawals are currently paused. your balance is safe — check back soon." }, { status: 403 })
}
