import { NextRequest, NextResponse } from "next/server"
import { prisma } from "@/lib/prisma"
import { isAdmin } from "@/lib/getAdmin"
import { createTransferRecipient, initiateTransfer } from "@/lib/paystack"

export async function POST(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  if (!isAdmin(req)) {
    return NextResponse.json({ error: "Not authorized." }, { status: 403 })
  }

  const { id } = await params

  const payout = await prisma.payout.findUnique({ where: { id } })
  if (!payout || payout.status !== "pending") {
    return NextResponse.json({ error: "Invalid or already-processed payout." }, { status: 400 })
  }

  const recipient = await createTransferRecipient(
    payout.accountName!,
    payout.accountNumber!,
    payout.bankCode!
  )

  if (!recipient.status) {
    return NextResponse.json({ error: "Failed to create transfer recipient." }, { status: 400 })
  }

  const transfer = await initiateTransfer(
    payout.amount,
    recipient.data.recipient_code,
    "Yard creator payout"
  )

  await prisma.payout.update({
    where: { id: payout.id },
    data: {
      status: transfer.status ? "paid" : "rejected",
      processedAt: new Date(),
    },
  })

  return NextResponse.json({ success: transfer.status, transfer })
}