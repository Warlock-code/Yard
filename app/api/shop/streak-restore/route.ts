import { NextRequest, NextResponse } from "next/server"
import { prisma } from "@/lib/prisma"
import { getCurrentUser } from "@/lib/getCurrentUser"
import { initializePaystack } from "@/lib/paystack"
import { creditUser, CREDIT_CONFIG } from "@/lib/credits"

const RESTORE_PRICE_PESEWAS = 300
const RESTORE_CREDIT_COST = CREDIT_CONFIG.SPEND.STREAK_RESTORE // 500 credits

export async function POST(req: NextRequest) {
  const user = await getCurrentUser(req)
  if (!user) return NextResponse.json({ error: "Not authenticated." }, { status: 401 })

  const withinGrace =
    user.streakBrokenAt && new Date(user.streakBrokenAt).getTime() > Date.now() - 48 * 60 * 60 * 1000

  if (!user.lastStreakCount || !withinGrace) {
    return NextResponse.json({ error: "No recently broken streak to restore." }, { status: 400 })
  }

  const body = await req.json().catch(() => ({}))
  const useCredits = body.useCredits === true

  if (useCredits) {
    try {
      const result = await creditUser(user.id, "STREAK_RESTORE", -RESTORE_CREDIT_COST, `restore_${user.id}_${Date.now()}`, {})
      return NextResponse.json({ success: true, creditsUsed: RESTORE_CREDIT_COST, newBalance: result.newBalance, message: "Streak restored with credits" })
    } catch (err) {
      return NextResponse.json({ error: err instanceof Error ? err.message : "Insufficient credits" }, { status: 400 })
    }
  }

  const reference = `restore_${user.id}_${Date.now()}`

  await prisma.transaction.create({
    data: { userId: user.id, kind: "restore", reference, amount: RESTORE_PRICE_PESEWAS },
  })

  try {
    const payment = await initializePaystack(user.email, RESTORE_PRICE_PESEWAS, reference)
    return NextResponse.json(payment)
  } catch (err) {
    await prisma.transaction.updateMany({ where: { reference, status: "pending" }, data: { status: "failed" } }).catch(() => {})
    console.error("[shop/restore] init failed", err)
    return NextResponse.json({ error: err instanceof Error ? err.message : "Checkout failed" }, { status: 400 })
  }
}