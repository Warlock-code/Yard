import { NextRequest, NextResponse } from "next/server"

export async function POST(req: NextRequest) {
  return NextResponse.json({ error: "Payouts are not available in current tier system." }, { status: 403 })
}