import { NextRequest, NextResponse } from "next/server"
import { prisma } from "@/lib/prisma"
import { getCurrentUser } from "@/lib/getCurrentUser"
import { initializeSubscription } from "@/lib/paystack"

const PLANS: Record<string, string> = {
  plus: process.env.PAYSTACK_PLUS_PLAN_CODE!,
  prime: process.env.PAYSTACK_PRIME_PLAN_CODE!,
}

const PLAN_PRICE_PESEWAS: Record<string, number> = {
  plus: Number(process.env.PAYSTACK_PLUS_PRICE_PESEWAS || 1000), // GHS 10
  prime: Number(process.env.PAYSTACK_PRIME_PRICE_PESEWAS || 2000), // GHS 20
}

export async function POST(req: NextRequest, { params }: { params: Promise<{ tier: string }> }) {
  const { tier: tierParam } = await params
  const user = await getCurrentUser(req)
  if (!user) return NextResponse.json({ error: "Not authenticated." }, { status: 401 })

  const tier = tierParam.toLowerCase()
  const planCode = PLANS[tier]
  if (!planCode) return NextResponse.json({ error: "Invalid tier." }, { status: 400 })

  // Server guard — frontend also blocks but we enforce here (agents flagged missing check)
  if (user.tier === "PRIME") return NextResponse.json({ error: "Already on Prime." }, { status: 400 })
  if (tier === "plus" && user.tier === "PLUS") return NextResponse.json({ error: "Already on Plus. Upgrade to Prime instead." }, { status: 400 })

  const reference = `sub_${tier}_${user.id}_${Date.now()}`
  const amount = PLAN_PRICE_PESEWAS[tier]
  if (!Number.isSafeInteger(amount) || amount <= 0) return NextResponse.json({ error: "Plan price not configured." }, { status: 500 })

  await prisma.transaction.create({
    data: {
      userId: user.id,
      kind: tier,
      reference,
      amount,
      metadata: { tier },
    },
  })

  const payment = await initializeSubscription(user.email, planCode, reference)

  return NextResponse.json(payment)
}