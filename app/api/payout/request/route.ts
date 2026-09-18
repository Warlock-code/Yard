import { NextRequest, NextResponse } from "next/server"
import { prisma } from "@/lib/prisma"
import { getCurrentUser } from "@/lib/getCurrentUser"
import { encrypt, maskAccountNumber } from "@/lib/payoutEncryption"
import { isTierActive } from "@/lib/tier"

function inPayoutWindow() {
  const day = new Date().getDate()
  const lastDayOfMonth = new Date(new Date().getFullYear(), new Date().getMonth() + 1, 0).getDate()
  const inEndOfMonth = day >= lastDayOfMonth - 2
  const inMidMonth = day >= 14 && day <= 16
  return inEndOfMonth || inMidMonth
}

const MOMO_BANK_CODES = new Set(["MTN", "VOD", "ATL", "AFB", "TIGO", "MTN_GH", "VOD_GH"])

function validateGhanaAccount(accountNumber: string, bankCode: string) {
  const normalized = bankCode.trim().toUpperCase()
  const isMomo = MOMO_BANK_CODES.has(normalized)
  if (isMomo) {
    if (!/^\d{10,15}$/.test(accountNumber)) {
      throw new Error("Invalid MoMo number (10-15 digits).")
    }
    if (!/^[A-Z0-9]{3,6}$/i.test(bankCode)) {
      throw new Error("Invalid MoMo bank code.")
    }
    return
  }
  if (!/^\d{10,15}$/.test(accountNumber)) {
    throw new Error("Invalid account number format (10-15 digits).")
  }
  if (!/^\d{6}$/.test(bankCode)) {
    throw new Error("Invalid bank code (6 digits for GHIPSS banks, or MTN/VOD/ATL etc. for MoMo).")
  }
}

export async function POST(req: NextRequest) {
  const user = await getCurrentUser(req)
  if (!user) return NextResponse.json({ error: "Not authenticated." }, { status: 401 })

  if (!isTierActive(user as any)) {
    return NextResponse.json({ error: user.tier !== "PRIME" ? "Only Prime accounts can request payouts." : "Your Prime expired — renew at yardapp.me/upgrade to request payouts.", }, { status: 403 })
  }

  if (!inPayoutWindow()) {
    return NextResponse.json({ error: "Payouts open at month-end and mid-month (14th–16th) only." }, { status: 400 })
  }

  const pending = await prisma.payout.findFirst({ where: { userId: user.id, status: { in: ["pending", "processing", "approved"] } } })
  if (pending) {
    return NextResponse.json({ error: "You already have a payout in progress (pending/processing/approved). Wait for it to settle." }, { status: 409 })
  }

  const { bankCode, accountNumber, accountName } = await req.json()
  if (
    typeof bankCode !== "string" || !bankCode.trim() ||
    typeof accountNumber !== "string" || !accountNumber.trim() ||
    typeof accountName !== "string" || !accountName.trim()
  ) {
    return NextResponse.json({ error: "Bank, account number and account name are required." }, { status: 400 })
  }

  try {
    validateGhanaAccount(accountNumber, bankCode)
  } catch (e) {
    return NextResponse.json({ error: e instanceof Error ? e.message : "Invalid bank details." }, { status: 400 })
  }

  const earnings = await prisma.earning.aggregate({ where: { userId: user.id }, _sum: { amount: true } })
  const alreadyPaid = await prisma.payout.aggregate({
    where: { userId: user.id, status: { in: ["pending", "processing", "approved", "paid"] } },
    _sum: { amount: true },
  })
  const available = (earnings._sum.amount || 0) - (alreadyPaid._sum.amount || 0)

  if (available < 2000) {
    return NextResponse.json({ error: "Minimum payout is GHS 20.00." }, { status: 400 })
  }

  const payout = await prisma.payout.create({
    data: {
      userId: user.id,
      amount: available,
      bankCode: encrypt(bankCode.trim()),
      accountNumber: encrypt(accountNumber.trim()),
      accountName: encrypt(accountName.trim()),
    },
  })

  return NextResponse.json({
    payout: {
      ...payout,
      bankCode: "****",
      accountNumber: maskAccountNumber(accountNumber),
      accountName: "****",
    },
  })
}