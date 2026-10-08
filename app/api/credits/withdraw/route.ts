import { NextRequest, NextResponse } from "next/server"
import { getCurrentUser } from "@/lib/getCurrentUser"
import { withdrawCredits, getUserCredits } from "@/lib/credits"
import { getEffectiveTier } from "@/lib/tier"
import { encrypt } from "@/lib/payoutEncryption"
import { prisma } from "@/lib/prisma"

export async function GET(req: NextRequest) {
  const user = await getCurrentUser(req)
  if (!user) return NextResponse.json({ error: "not authenticated." }, { status: 401 })

  const credits = await getUserCredits(user.id)
  return NextResponse.json({ credits })
}

export async function POST(req: NextRequest) {
  const user = await getCurrentUser(req)
  if (!user) return NextResponse.json({ error: "not authenticated." }, { status: 401 })

  // Payouts are a Prime perk — check effective tier (expiry-aware).
  const dbUser = await prisma.user.findUnique({
    where: { id: user.id },
    select: { tier: true, tierExpiresAt: true },
  })
  if (!dbUser || getEffectiveTier(dbUser) !== "PRIME") {
    return NextResponse.json({ error: "payouts are a prime perk. upgrade to prime to withdraw." }, { status: 403 })
  }

  const body = await req.json().catch(() => ({}))
  const { creditsAmount, bankCode, accountNumber, accountName } = body

  if (!creditsAmount || typeof creditsAmount !== "number" || creditsAmount <= 0) {
    return NextResponse.json({ error: "valid creditsAmount is required." }, { status: 400 })
  }
  if (!bankCode || !accountNumber || !accountName) {
    return NextResponse.json({ error: "bank details are required." }, { status: 400 })
  }

  // Encrypt bank details at rest — fail closed if no encryption key.
  let encBankCode: string
  let encAccountNumber: string
  let encAccountName: string
  try {
    encBankCode = encrypt(String(bankCode))
    encAccountNumber = encrypt(String(accountNumber))
    encAccountName = encrypt(String(accountName))
  } catch {
    return NextResponse.json({ error: "payouts unavailable right now. try again later." }, { status: 503 })
  }

  try {
    const result = await withdrawCredits(user.id, creditsAmount, encBankCode, encAccountNumber, encAccountName)
    return NextResponse.json({ success: true, ...result })
  } catch (err) {
    return NextResponse.json({ error: err instanceof Error ? err.message : "withdrawal failed." }, { status: 400 })
  }
}
