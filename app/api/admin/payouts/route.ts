import { NextRequest, NextResponse } from "next/server"
import { isAdmin } from "@/lib/getAdmin"

export const dynamic = "force-dynamic"

export async function GET(req: NextRequest) {
  if (!isAdmin(req)) {
    return NextResponse.json({ error: "Not authorized." }, { status: 403 })
  }

  return NextResponse.json({ payouts: [] })
}