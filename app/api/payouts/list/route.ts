import { NextResponse } from "next/server"

export async function GET() {
  return NextResponse.json({ error: "payouts are not available in current tier system." }, { status: 403 })
}