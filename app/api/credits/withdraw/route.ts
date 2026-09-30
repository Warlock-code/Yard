import { NextRequest, NextResponse } from "next/server"
import { getCurrentUser } from "@/lib/getCurrentUser"

export async function GET(req: NextRequest) {
  const user = await getCurrentUser(req)
  if (!user) return NextResponse.json({ error: "Not authenticated." }, { status: 401 })

  return NextResponse.json({ credits: { balance: 0, earned: 0, purchased: 0, withdrawn: 0, tier: "FREE" } })
}

export async function POST(req: NextRequest) {
  return NextResponse.json({ error: "Withdrawals are disabled." }, { status: 403 })
}