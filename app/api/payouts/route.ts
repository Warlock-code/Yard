import { NextRequest, NextResponse } from "next/server"
import { prisma } from "@/lib/prisma"
import { getCurrentUser } from "@/lib/getCurrentUser"
import { getEffectiveTier } from "@/lib/tier"

const MIN_PAYOUT_PESEWAS = 2000

export async function POST(req: NextRequest) {
  const user = await getCurrentUser(req)
  if (!user) return NextResponse.json({ error: "Not authenticated." }, { status: 401 })

  const effectiveTier = getEffectiveTier(user)
  if (effectiveTier !== "PRIME") {
    return NextResponse.json({ error: "Only Prime users can request payouts." }, { status: 403 })
  }

  const { bankCode, accountNumber, accountName } = await req.json()
  if (!bankCode || !accountNumber || !accountName) {
    return NextResponse.json({ error: "Bank details required." }, { status: 400 })
  }

  const totalEarned = await prisma.earning.aggregate({
    where: { userId: user.id },
    _sum: { amount: true },
  })
  const totalPaidOut = await prisma.payout.aggregate({
    where: { userId: user.id, status: { in: ["approved", "paid", "processing"] } },
    _sum: { amount: true },
  })
  const available = (totalEarned._sum.amount || 0) - (totalPaidOut._sum.amount || 0)

  if (available < MIN_PAYOUT_PESEWAS) {
    return NextResponse.json(
      { error: `Minimum payout is GHS ${(MIN_PAYOUT_PESEWAS / 100).toFixed(2)}. Available: GHS ${(available / 100).toFixed(2)}` },
      { status: 400 }
    )
  }

  const payout = await prisma.payout.create({
    data: {
      userId: user.id,
      amount: available,
      bankCode,
      accountNumber,
      accountName,
      status: "pending",
    },
  })

  return NextResponse.json({ payout })
}