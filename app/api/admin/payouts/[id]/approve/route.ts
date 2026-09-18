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
    await prisma.payout.updateMany({ where: { id: payout.id, status: "processing" }, data: { status: "pending" } })
    return NextResponse.json({ error: "Failed to decrypt payout details." }, { status: 500 })
  }

  // Wrap Paystack calls so network errors don't strand as processing forever
  let recipient: any
  try {
    recipient = await createTransferRecipient(accountName, accountNumber, bankCode)
  } catch (e) {
    await prisma.payout.updateMany({ where: { id: payout.id, status: "processing" }, data: { status: "pending" } })
    return NextResponse.json({ error: "Paystack recipient error - check PAYSTACK_SECRET_KEY and network." }, { status: 502 })
  }

  if (!recipient?.status) {
    await prisma.payout.updateMany({ where: { id: payout.id, status: "processing" }, data: { status: "pending" } })
    return NextResponse.json({ error: recipient?.message || "Failed to create transfer recipient." }, { status: 400 })
  }

  const reference = `payout_${payout.id}`

  // If this payout was already approved earlier (retry after crash), reuse reference
  if (payout.providerTransferRef) {
    // Already has a reference - don't create duplicate transfer, just mark approved
    await prisma.payout.update({
      where: { id: payout.id },
      data: { status: "approved", providerTransferRef: payout.providerTransferRef, processedAt: new Date() },
    })
    return NextResponse.json({ success: true, reused: true })
  }

  let transfer: any
  try {
    transfer = await initiateTransfer(payout.amount, recipient.data.recipient_code, "Yard creator payout", reference)
  } catch (e) {
    await prisma.payout.updateMany({ where: { id: payout.id, status: "processing" }, data: { status: "pending" } })
    return NextResponse.json({ error: "Paystack transfer error - check balance and try again." }, { status: 502 })
  }

  if (!transfer?.status) {
    // Paystack can return false for duplicate reference (already sent) - don't strand
    const msg = transfer?.message || "Transfer initiation failed."
    // If duplicate reference, treat as already approved
    if (typeof msg === "string" && msg.toLowerCase().includes("duplicate")) {
      await prisma.payout.update({ where: { id: payout.id }, data: { status: "approved", providerTransferRef: reference, processedAt: new Date() } })
      return NextResponse.json({ success: true, duplicate: true })
    }
    await prisma.payout.updateMany({ where: { id: payout.id, status: "processing" }, data: { status: "pending" } })
    return NextResponse.json({ error: msg }, { status: 400 })
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