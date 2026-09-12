import { NextRequest, NextResponse } from "next/server"
import { prisma } from "@/lib/prisma"
import { getCurrentUser } from "@/lib/getCurrentUser"
import { initializePaystack } from "@/lib/paystack"

const BOOST_PRICE_PESEWAS = 500

export async function POST(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params
  const user = await getCurrentUser(req)
  if (!user) return NextResponse.json({ error: "Not authenticated." }, { status: 401 })

  const reference = `boost_${id}_${Date.now()}`

  await prisma.transaction.create({
    data: {
      userId: user.id,
      kind: "boost",
      reference,
      amount: BOOST_PRICE_PESEWAS,
      metadata: { postId: id },
    },
  })

  const payment = await initializePaystack(user.email, BOOST_PRICE_PESEWAS, reference)

  return NextResponse.json(payment)
}