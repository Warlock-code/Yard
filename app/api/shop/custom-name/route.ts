import { NextRequest, NextResponse } from "next/server"
import { prisma } from "@/lib/prisma"
import { getCurrentUser } from "@/lib/getCurrentUser"
import { initializePaystack } from "@/lib/paystack"

const CUSTOM_NAME_PRICE_PESEWAS = 500 // GHS 5.00

export async function POST(req: NextRequest) {
  const user = await getCurrentUser(req)
  if (!user) return NextResponse.json({ error: "Not authenticated." }, { status: 401 })

  const { newName } = await req.json()
  if (!newName?.trim()) return NextResponse.json({ error: "Enter a name." }, { status: 400 })

  const taken = await prisma.user.findUnique({ where: { ghostId: newName } })
  if (taken) return NextResponse.json({ error: "That ghost name is taken." }, { status: 400 })

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

  const payment = await initializePaystack(user.email, CUSTOM_NAME_PRICE_PESEWAS, reference)
  return NextResponse.json(payment)
}