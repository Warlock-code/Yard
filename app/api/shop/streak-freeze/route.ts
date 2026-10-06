import { NextRequest, NextResponse } from "next/server"
import { prisma } from "@/lib/prisma"
import { getCurrentUser } from "@/lib/getCurrentUser"
import { initializePaystack } from "@/lib/paystack"
import { creditUser, CREDIT_CONFIG } from "@/lib/credits"

const FREEZE_PRICE_PESEWAS = 200 // GHS 2.00
const FREEZE_CREDIT_COST = CREDIT_CONFIG.SPEND.STREAK_FREEZE_7D // 200 credits

export async function POST(req: NextRequest) {
  const user = await getCurrentUser(req)
  if (!user) return NextResponse.json({ error: "not authenticated." }, { status: 401 })

  const body = await req.json().catch(() => ({}))
  const useCredits = body.useCredits === true

  if (useCredits) {
    const reference = `freeze_${user.id}_${Date.now()}`
    try {
      const result = await creditUser(user.id, "STREAK_FREEZE", -FREEZE_CREDIT_COST, reference, {})
      try {
        await prisma.user.update({
          where: { id: user.id },
          data: { streakFreezeUntil: new Date(Date.now() + 48 * 60 * 60 * 1000) },
        })
      } catch {
        await creditUser(user.id, "STREAK_FREEZE", FREEZE_CREDIT_COST, `${reference}_refund`, { refund: true }).catch(() => {})
        return NextResponse.json({ error: "purchase failed, credits refunded. try again." }, { status: 500 })
      }
      return NextResponse.json({ success: true, creditsUsed: FREEZE_CREDIT_COST, newBalance: result.newBalance, message: "streak freeze purchased with credits" })
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