import { NextRequest, NextResponse } from "next/server"
import crypto from "crypto"
import { prisma } from "@/lib/prisma"
import { fulfillPaidTransaction } from "@/lib/paystackFulfillment"

export async function POST(req: NextRequest) {
  const body = await req.text()
  const signature = req.headers.get("x-paystack-signature")

  const hash = crypto
    .createHmac("sha512", process.env.PAYSTACK_WEBHOOK_SECRET!)
    .update(body)
    .digest("hex")

  if (hash !== signature) {
    return NextResponse.json({ error: "Invalid signature." }, { status: 401 })
  }

  const event = JSON.parse(body)

  if (event.event === "charge.success") {
    const reference = event.data.reference
    const tx = await prisma.transaction.findUnique({ where: { reference } })

    if (tx && tx.status !== "success") {
      await fulfillPaidTransaction(reference)
    }
  }

  if (event.event === "transfer.success" || event.event === "transfer.failed" || event.event === "transfer.reversed") {
    const trRef = event.data?.reference || ""
    if (typeof trRef === "string" && trRef.startsWith("payout_")) {
      const payout = await prisma.payout.findUnique({ where: { providerTransferRef: trRef } })
      if (payout && payout.status === "approved") {
        if (event.event === "transfer.success") {
          await prisma.payout.update({ where: { id: payout.id }, data: { status: "paid", processedAt: new Date() } })
        } else {
          await prisma.payout.update({ where: { id: payout.id }, data: { status: "rejected" } })
        }
      }
    }
  }

  if (event.event === "subscription.disable") {
    const customerEmail = event.data.customer.email
    const user = await prisma.user.findUnique({ where: { email: customerEmail } })
    if (user) {
      await prisma.user.update({ where: { id: user.id }, data: { tier: "FREE", tierExpiresAt: null } })
    }
  }

  return NextResponse.json({ received: true })
}