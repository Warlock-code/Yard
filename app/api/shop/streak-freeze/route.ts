import { NextRequest, NextResponse } from "next/server"
import { prisma } from "@/lib/prisma"
import { getCurrentUser } from "@/lib/getCurrentUser"
import { initializePaystack } from "@/lib/paystack"

const FREEZE_PRICE_PESEWAS = 200 // GHS 2.00

export async function POST(req: NextRequest) {
  const user = await getCurrentUser(req)
  if (!user) return NextResponse.json({ error: "Not authenticated." }, { status: 401 })

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