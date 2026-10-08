import { NextRequest, NextResponse } from "next/server"
import { isAdmin } from "@/lib/getAdmin"

export const dynamic = "force-dynamic"
export const revalidate = 0
export const fetchCache = "force-no-store"

export async function POST(req: NextRequest) {
  if (!isAdmin(req)) {
    return NextResponse.json({ error: "not authorized." }, { status: 403 })
  }

  // Withdrawals paused pending licensing/KYC review — fail closed.
  // No Paystack transfer may be initiated while paused. Rejections still
  // work via /api/admin/credits (reject_payout refunds the user).
  // Original transfer logic kept in git history
  // (`git log -- app/api/admin/payouts/[id]/approve/route.ts`) — restore
  // it here once cleared by counsel.
  return NextResponse.json({ error: "withdrawals are currently paused. approval disabled." }, { status: 403 })
}
