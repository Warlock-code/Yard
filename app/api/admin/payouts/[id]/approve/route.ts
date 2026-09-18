import { NextRequest, NextResponse } from "next/server"
import { prisma } from "@/lib/prisma"
import { isAdmin } from "@/lib/getAdmin"
import { createTransferRecipient, initiateTransfer } from "@/lib/paystack"
import { decrypt } from "@/lib/payoutEncryption"

export const dynamic = "force-dynamic"
export const revalidate = 0
export const fetchCache = "force-no-store"

export async function POST(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  if (!isAdmin(req)) {
    return NextResponse.json({ error: "Not authorized." }, { status: 403 })
  }

  const { id } = await params

  const payout = await prisma.payout.findUnique({ where: { id } })
  if (!payout || payout.status !== "pending") {
    return NextResponse.json({ error: "Invalid or already-processed payout." }, { status: 400 })
  }

  const claim = await prisma.payout.updateMany({
    where: { id: payout.id, status: "pending" },
    data: { status: "processing" },
  })
  if (claim.count !== 1) {
    return NextResponse.json({ error: "Payout already claimed for processing." }, { status: 409 })
  }

  let accountName: string
  let accountNumber: string
  let bankCode: string
  try {
    accountName = decrypt(payout.accountName!)
    accountNumber = decrypt(payout.accountNumber!)
    bankCode = decrypt(payout.bankCode!)
  } catch {
    await prisma.payout.update({ where: { id: payout.id }, data: { status: "pending" } })
    return NextResponse.json({ error: "Failed to decrypt payout details." }, { status: 500 })
  }

  const recipient = await createTransferRecipient(accountName, accountNumber, bankCode)

  if (!recipient.status) {
    await prisma.payout.update({ where: { id: payout.id }, data: { status: "pending" } })
    return NextResponse.json({ error: "Failed to create transfer recipient." }, { status: 400 })
  }

  const reference = `payout_${payout.id}`

  const transfer = await initiateTransfer(
    payout.amount,
    recipient.data.recipient_code,
    "Yard creator payout",
    reference
  )

  if (!transfer.status) {
    await prisma.payout.update({ where: { id: payout.id }, data: { status: "pending" } })
    return NextResponse.json({ error: "Transfer initiation failed." }, { status: 400 })
  }

  await prisma.payout.update({
    where: { id: payout.id },
    data: {
      status: "approved",
      providerTransferRef: reference,
      processedAt: new Date(),
    },
  })

  return NextResponse.json({ success: true, transfer })
}