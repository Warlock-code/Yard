import { NextRequest, NextResponse } from "next/server"
import { prisma } from "@/lib/prisma"
import { getCurrentUser } from "@/lib/getCurrentUser"
import { initializePaystack } from "@/lib/paystack"
import { creditUser, CREDIT_CONFIG } from "@/lib/credits"

const STORAGE_PRICE_PESEWAS = 1000 // GHS 10.00 for +100MB
const STORAGE_BOOST_MB = 100
const STORAGE_CREDIT_COST = CREDIT_CONFIG.SPEND.STORAGE_100MB // 200 credits

export async function POST(req: NextRequest) {
  const user = await getCurrentUser(req)
  if (!user) return NextResponse.json({ error: "Not authenticated." }, { status: 401 })

  const body = await req.json().catch(() => ({}))
  const useCredits = body.useCredits === true

  if (useCredits) {
    try {
      const result = await creditUser(user.id, "STORAGE_PURCHASE", -STORAGE_CREDIT_COST, `storage_${user.id}_${Date.now()}`, { mb: STORAGE_BOOST_MB })
      return NextResponse.json({ success: true, creditsUsed: STORAGE_CREDIT_COST, newBalance: result.newBalance, message: "Storage purchased with credits" })
    } catch (err) {
      return NextResponse.json({ error: err instanceof Error ? err.message : "Insufficient credits" }, { status: 400 })
    }
  }

  const reference = `storage_${user.id}_${Date.now()}`

  await prisma.transaction.create({
    data: { userId: user.id, kind: "storage", reference, amount: STORAGE_PRICE_PESEWAS, metadata: { mb: STORAGE_BOOST_MB } },
  })

  try {
    const payment = await initializePaystack(user.email, STORAGE_PRICE_PESEWAS, reference)
    return NextResponse.json(payment)
  } catch (err) {
    await prisma.transaction.updateMany({ where: { reference, status: "pending" }, data: { status: "failed" } }).catch(() => {})
    console.error("[shop/storage] init failed", err)
    return NextResponse.json({ error: err instanceof Error ? err.message : "Checkout failed" }, { status: 400 })
  }
}