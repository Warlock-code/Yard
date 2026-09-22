import { NextRequest, NextResponse } from "next/server"
import { prisma } from "@/lib/prisma"
import { verifyPaystack } from "@/lib/paystack"
import { fulfillPaidTransaction, validatePaystackCharge } from "@/lib/paystackFulfillment"
import { getCurrentUser } from "@/lib/getCurrentUser"

export async function POST(req: NextRequest) {
  const user = await getCurrentUser(req)
  if (!user) return NextResponse.json({ error: "Not authenticated." }, { status: 401 })

  const { reference } = await req.json().catch(() => ({}))
  if (typeof reference !== "string" || !reference) return NextResponse.json({ error: "Invalid payment reference." }, { status: 400 })

  const transaction = await prisma.transaction.findUnique({ where: { reference } })
  if (!transaction || transaction.userId !== user.id) return NextResponse.json({ error: "Transaction not found." }, { status: 404 })

  const result = await verifyPaystack(reference)
  try {
    await validatePaystackCharge(reference, result.data)
    await fulfillPaidTransaction(reference)
  } catch (error) {
    return NextResponse.json({ error: error instanceof Error ? error.message : "Payment not verified." }, { status: 400 })
  }

  const fulfilled = await prisma.transaction.findUnique({ where: { reference }, select: { kind: true, metadata: true } })
  return NextResponse.json({ success: true, kind: fulfilled?.kind ?? null, metadata: fulfilled?.metadata ?? null })
}
