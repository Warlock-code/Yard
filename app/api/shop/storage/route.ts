import { NextRequest, NextResponse } from "next/server"
import { prisma } from "@/lib/prisma"
import { getCurrentUser } from "@/lib/getCurrentUser"
import { initializePaystack } from "@/lib/paystack"

const STORAGE_PRICE_PESEWAS = 1000 // GHS 10.00 for +100MB, adjust as needed
const STORAGE_BOOST_MB = 100

export async function POST(req: NextRequest) {
  const user = await getCurrentUser(req)
  if (!user) return NextResponse.json({ error: "Not authenticated." }, { status: 401 })

  const reference = `storage_${user.id}_${Date.now()}`

  await prisma.transaction.create({
    data: { userId: user.id, kind: "storage", reference, amount: STORAGE_PRICE_PESEWAS, metadata: { mb: STORAGE_BOOST_MB } },
  })

  const payment = await initializePaystack(user.email, STORAGE_PRICE_PESEWAS, reference)
  return NextResponse.json(payment)
}