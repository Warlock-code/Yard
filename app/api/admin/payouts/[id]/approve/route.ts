import { NextRequest, NextResponse } from "next/server"
import { prisma } from "@/lib/prisma"
import { isAdmin } from "@/lib/getAdmin"
import { createTransferRecipient, initiateTransfer } from "@/lib/paystack"
import { decrypt } from "@/lib/payoutEncryption"

export const dynamic = "force-dynamic"
export const revalidate = 0
export const fetchCache = "force-no-store"

function mustDecrypt(value: string): string {
  try {
    return decrypt(value)
  } catch {
    // Rows stored before encryption — use raw.
    return value
  }
}

export async function POST(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  if (!isAdmin(req)) {
    return NextResponse.json({ error: "not authorized." }, { status: 403 })
  }

  const { id } = await params

  const payout = await prisma.creditPayout.findUnique({ where: { id } })
  if (!payout || payout.status !== "pending") {
    return NextResponse.json({ error: "invalid or already-processed payout." }, { status: 400 })
  }

  // Claim so two admins can't double-send.
  const claim = await prisma.creditPayout.updateMany({
    where: { id: payout.id, status: "pending" },
    data: { status: "processing" },
  })
  if (claim.count !== 1) {
    return NextResponse.json({ error: "payout already claimed for processing." }, { status: 409 })
  }

  const revert = () =>
    prisma.creditPayout.updateMany({
      where: { id: payout.id, status: "processing" },
      data: { status: "pending" },
    })

  let accountName: string
  let accountNumber: string
  let bankCode: string
  try {
    accountName = mustDecrypt(payout.accountName)
    accountNumber = mustDecrypt(payout.accountNumber)
    bankCode = mustDecrypt(payout.bankCode)
  } catch {
    await revert()
    return NextResponse.json({ error: "failed to read payout details." }, { status: 500 })
  }

  // Retry after crash: reference already exists — just mark approved.
  const reference = payout.providerRef || `payout_${payout.id}`
  if (payout.providerRef) {
    await prisma.creditPayout.update({
      where: { id: payout.id },
      data: { status: "approved", processedAt: new Date() },
    })
    return NextResponse.json({ success: true, reused: true })
  }

  let recipient: { status?: boolean; message?: string; data?: { recipient_code?: string } }
  try {
    recipient = await createTransferRecipient(accountName, accountNumber, bankCode)
  } catch {
    await revert()
    return NextResponse.json({ error: "paystack recipient error — check keys and network." }, { status: 502 })
  }

  if (!recipient?.status || !recipient.data?.recipient_code) {
    await revert()
    return NextResponse.json({ error: recipient?.message || "failed to create transfer recipient." }, { status: 400 })
  }

  let transfer: { status?: boolean; message?: string }
  try {
    transfer = await initiateTransfer(payout.netGhsAmount, recipient.data.recipient_code, "yard creator payout", reference)
  } catch {
    await revert()
    return NextResponse.json({ error: "paystack transfer error — check balance and try again." }, { status: 502 })
  }

  if (!transfer?.status) {
    const msg = transfer?.message || "transfer initiation failed."
    if (msg.toLowerCase().includes("duplicate")) {
      await prisma.creditPayout.update({
        where: { id: payout.id },
        data: { status: "approved", providerRef: reference, processedAt: new Date() },
      })
      return NextResponse.json({ success: true, duplicate: true })
    }
    await revert()
    return NextResponse.json({ error: msg }, { status: 400 })
  }

  await prisma.creditPayout.update({
    where: { id: payout.id },
    data: { status: "approved", providerRef: reference, processedAt: new Date() },
  })
  return NextResponse.json({ success: true })
}
