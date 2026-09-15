import { NextRequest, NextResponse } from "next/server"
import { prisma } from "@/lib/prisma"
import { getCurrentUser } from "@/lib/getCurrentUser"

function inPayoutWindow() {
  const day = new Date().getDate()
  const lastDayOfMonth = new Date(new Date().getFullYear(), new Date().getMonth() + 1, 0).getDate()
  const inEndOfMonth = day >= lastDayOfMonth - 2
  const inMidMonth = day >= 14 && day <= 16
  return inEndOfMonth || inMidMonth
}

export async function POST(req: NextRequest) {
  const user = await getCurrentUser(req)
  if (!user) return NextResponse.json({ error: "Not authenticated." }, { status: 401 })

  if (user.tier !== "PRIME") {
    return NextResponse.json({ error: "Only Prime accounts can request payouts." }, { status: 403 })
  }

  if (!inPayoutWindow()) {
    return NextResponse.json({ error: "Payouts open at month-end and mid-month (14th–16th) only." }, { status: 400 })
  }

  const { bankCode, accountNumber, accountName } = await req.json()

  const earnings = await prisma.earning.aggregate({ where: { userId: user.id }, _sum: { amount: true } })
  const alreadyPaid = await prisma.payout.aggregate({
    where: { userId: user.id, status: { in: ["approved", "paid"] } },
    _sum: { amount: true },
  })
  const available = (earnings._sum.amount || 0) - (alreadyPaid._sum.amount || 0)

  if (available < 2000) {
    return NextResponse.json({ error: "Minimum payout is GHS 20.00." }, { status: 400 })
  }

  const payout = await prisma.payout.create({
    data: { userId: user.id, amount: available, bankCode, accountNumber, accountName },
  })

  return NextResponse.json({ payout })
}