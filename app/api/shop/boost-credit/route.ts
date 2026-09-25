import { NextRequest, NextResponse } from "next/server"
import { prisma } from "@/lib/prisma"
import { getCurrentUser } from "@/lib/getCurrentUser"
import { initializePaystack } from "@/lib/paystack"
import { creditUser, CREDIT_CONFIG } from "@/lib/credits"

const BOOST_CREDIT_PRICE_PESEWAS = 500
const BOOST_CREDIT_COST = CREDIT_CONFIG.SPEND.BOOST_24H // 300 credits

export async function POST(req: NextRequest) {
  const user = await getCurrentUser(req)
  if (!user) return NextResponse.json({ error: "Not authenticated." }, { status: 401 })

  const body = await req.json().catch(() => ({}))
  const useCredits = body.useCredits === true

  if (useCredits) {
    try {
      const result = await creditUser(user.id, "BOOST_PURCHASE", -BOOST_CREDIT_COST, `boostcredit_${user.id}_${Date.now()}`, {})
      return NextResponse.json({ success: true, creditsUsed: BOOST_CREDIT_COST, newBalance: result.newBalance, message: "Boost credit purchased with credits" })
    } catch (err) {
      return NextResponse.json({ error: err instanceof Error ? err.message : "Insufficient credits" }, { status: 400 })
    }
  }

  const reference = `boostcredit_${user.id}_${Date.now()}`

  await prisma.transaction.create({
    data: { userId: user.id, kind: "boost_credit", reference, amount: BOOST_CREDIT_PRICE_PESEWAS },
  })

  try {
    const payment = await initializePaystack(user.email, BOOST_CREDIT_PRICE_PESEWAS, reference)
    return NextResponse.json(payment)
  } catch (err) {
    await prisma.transaction.updateMany({ where: { reference, status: "pending" }, data: { status: "failed" } }).catch(() => {})
    console.error("[shop/boost-credit] init failed", err)
    return NextResponse.json({ error: err instanceof Error ? err.message : "Checkout failed" }, { status: 400 })
  }
}