import { NextRequest, NextResponse } from "next/server"
import { getCurrentUser } from "@/lib/getCurrentUser"
import { withdrawCredits, getUserCredits } from "@/lib/credits"

export async function GET(req: NextRequest) {
  const user = await getCurrentUser(req)
  if (!user) return NextResponse.json({ error: "Not authenticated." }, { status: 401 })

  const credits = await getUserCredits(user.id)
  return NextResponse.json({ credits })
}

export async function POST(req: NextRequest) {
  const user = await getCurrentUser(req)
  if (!user) return NextResponse.json({ error: "Not authenticated." }, { status: 401 })

  const body = await req.json().catch(() => ({}))
  const { creditsAmount, bankCode, accountNumber, accountName } = body

  if (!creditsAmount || typeof creditsAmount !== "number" || creditsAmount <= 0) {
    return NextResponse.json({ error: "Valid creditsAmount is required" }, { status: 400 })
  }
  if (!bankCode || !accountNumber || !accountName) {
    return NextResponse.json({ error: "Bank details are required" }, { status: 400 })
  }

  try {
    const result = await withdrawCredits(user.id, creditsAmount, bankCode, accountNumber, accountName)
    return NextResponse.json({ success: true, ...result })
  } catch (err) {
    return NextResponse.json({ error: err instanceof Error ? err.message : "Withdrawal failed" }, { status: 400 })
  }
}