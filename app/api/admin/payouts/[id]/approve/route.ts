import { NextRequest, NextResponse } from "next/server"
import { prisma } from "@/lib/prisma"
import { getCurrentUser } from "@/lib/getCurrentUser"
import { createTransferRecipient, initiateTransfer } from "@/lib/paystack"

// Simple admin check for now — swap for a real isAdmin flag/role later
const ADMIN_EMAILS = [process.env.ADMIN_EMAIL || ""]

export async function POST(req: NextRequest, { params }: { params: { id: string } }) {
  const user = await getCurrentUser(req)
  if (!user || !ADMIN_EMAILS.includes(user.email)) {
    return NextResponse.json({ error: "Not authorized." }, { status: 403 })
  }

  const payout = await prisma.payout.findUnique({ where: { id: params.id } })
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