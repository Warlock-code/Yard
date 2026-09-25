import { NextRequest, NextResponse } from "next/server"
import { prisma } from "@/lib/prisma"
import { getCurrentUser } from "@/lib/getCurrentUser"
import { initializePaystack } from "@/lib/paystack"
import { creditUser, CREDIT_CONFIG } from "@/lib/credits"

const CUSTOM_NAME_PRICE_PESEWAS = 500 // GHS 5.00
const CUSTOM_NAME_CREDIT_COST = CREDIT_CONFIG.SPEND.CUSTOM_NAME // 300 credits

export async function POST(req: NextRequest) {
  const user = await getCurrentUser(req)
  if (!user) return NextResponse.json({ error: "Not authenticated." }, { status: 401 })

  const body = await req.json().catch(() => ({}))
  const { newName } = body
  const useCredits = body.useCredits === true

  if (!newName?.trim()) return NextResponse.json({ error: "Enter a name." }, { status: 400 })

  const taken = await prisma.user.findUnique({ where: { ghostId: newName } })
  if (taken) return NextResponse.json({ error: "That ghost name is taken." }, { status: 400 })

  if (useCredits) {
    try {
      const result = await creditUser(user.id, "CUSTOM_NAME", -CUSTOM_NAME_CREDIT_COST, `custom_name_${user.id}_${Date.now()}`, { newName })
      await prisma.user.update({ where: { id: user.id }, data: { ghostId: newName.toLowerCase() } })
      return NextResponse.json({ success: true, creditsUsed: CUSTOM_NAME_CREDIT_COST, newBalance: result.newBalance, ghostId: newName.toLowerCase(), message: "Ghost name changed with credits" })
    } catch (err) {
      return NextResponse.json({ error: err instanceof Error ? err.message : "Insufficient credits" }, { status: 400 })
    }
  }

  const reference = `custom_name_${user.id}_${Date.now()}`

  await prisma.transaction.create({
    data: {
      userId: user.id,
      kind: "custom_name",
      reference,
      amount: CUSTOM_NAME_PRICE_PESEWAS,
      metadata: { newName },
    },
  })

  try {
    const payment = await initializePaystack(user.email, CUSTOM_NAME_PRICE_PESEWAS, reference)
    return NextResponse.json(payment)
  } catch (err) {
    await prisma.transaction.updateMany({ where: { reference, status: "pending" }, data: { status: "failed" } }).catch(() => {})
    console.error("[shop/custom-name] init failed", err)
    return NextResponse.json({ error: err instanceof Error ? err.message : "Checkout failed" }, { status: 400 })
  }
}