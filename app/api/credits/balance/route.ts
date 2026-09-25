import { NextRequest, NextResponse } from "next/server"
import { getCurrentUser } from "@/lib/getCurrentUser"
import { getUserCredits, getCreditTransactions, getCreditPayouts } from "@/lib/credits"

export async function GET(req: NextRequest) {
  const user = await getCurrentUser(req)
  if (!user) return NextResponse.json({ error: "Not authenticated." }, { status: 401 })

  const credits = await getUserCredits(user.id)
  return NextResponse.json({ credits })
}