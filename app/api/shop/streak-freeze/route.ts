import { NextRequest, NextResponse } from "next/server"
import { prisma } from "@/lib/prisma"
import { getCurrentUser } from "@/lib/getCurrentUser"
import { initializePaystack } from "@/lib/paystack"
import { creditUser, CREDIT_CONFIG } from "@/lib/credits"

const FREEZE_PRICE_PESEWAS = 200 // GHS 2.00
const FREEZE_CREDIT_COST = CREDIT_CONFIG.SPEND.STREAK_FREEZE_7D // 200 credits

export async function POST(req: NextRequest) {
  const user = await getCurrentUser(req)
  if (!user) return NextResponse.json({ error: "Not authenticated." }, { status: 401 })

  const body = await req.json().catch(() => ({}))
  const useCredits = body.useCredits === true

  if (useCredits) {
    try {
      const result = await creditUser(user.id, "STREAK_FREEZE", -FREEZE_CREDIT_COST, `freeze_${user.id}_${Date.now()}`, {})
      return NextResponse.json({ success: true, creditsUsed: FREEZE_CREDIT_COST, newBalance: result.newBalance, message: "Streak freeze purchased with credits" })
    } catch (err) {
      return NextResponse.json({ error: err instanceof Error ? err.message : "Insufficient credits" }, { status: 400 })
    }
  }

  const reference = `freeze_${user.id}_${Date.now()}`

  await prisma.transaction.create({
    data: { userId: user.id, kind: "freeze", reference, amount: FREEZE_PRICE_PESEWAS },
  })

  try {
    const payment = await initializePaystack(user.email, FREEZE_PRICE_PESEWAS, reference)
    return NextResponse.json(payment)
  } catch (err) {
    await prisma.transaction.updateMany({ where: { reference, status: "pending" }, data: { status: "failed" } }).catch(() => {})
    console.error("[shop/freeze] init failed", err)
    return NextResponse.json({ error: err instanceof Error ? err.message : "Checkout failed" }, { status: 400 })
  }
}