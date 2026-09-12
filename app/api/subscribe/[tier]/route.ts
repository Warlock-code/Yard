import { NextRequest, NextResponse } from "next/server"
import { prisma } from "@/lib/prisma"
import { getCurrentUser } from "@/lib/getCurrentUser"
import { initializeSubscription } from "@/lib/paystack"

const PLANS: Record<string, string> = {
  plus: process.env.PAYSTACK_PLUS_PLAN_CODE!,
  prime: process.env.PAYSTACK_PRIME_PLAN_CODE!,
}

export async function POST(req: NextRequest, { params }: { params: { tier: string } }) {
  const user = await getCurrentUser(req)
  if (!user) return NextResponse.json({ error: "Not authenticated." }, { status: 401 })

  const tier = params.tier.toLowerCase()
  const planCode = PLANS[tier]
  if (!planCode) return NextResponse.json({ error: "Invalid tier." }, { status: 400 })

  const reference = `sub_${tier}_${user.id}_${Date.now()}`

  await prisma.transaction.create({
    data: {
      userId: user.id,
      kind: tier, // "plus" | "prime"
      reference,
      amount: 0, // Paystack knows the real amount from the plan
      metadata: { tier },
    },
  })

  const payment = await initializeSubscription(user.email, planCode, reference)

  return NextResponse.json(payment)
}