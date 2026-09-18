import { NextRequest, NextResponse } from "next/server"
import crypto from "crypto"
import { prisma } from "@/lib/prisma"
import { fulfillPaidTransaction } from "@/lib/paystackFulfillment"
import { handleCors, addCorsHeaders } from "@/lib/cors"

export async function POST(req: NextRequest) {
  const corsPreflight = handleCors(req)
  if (corsPreflight) return corsPreflight

  const body = await req.text()
  const signature = req.headers.get("x-paystack-signature")

  const webhookSecret = process.env.PAYSTACK_WEBHOOK_SECRET
  if (!webhookSecret) {
    console.error("PAYSTACK_WEBHOOK_SECRET not configured")
    return addCorsHeaders(NextResponse.json({ error: "Webhook not configured" }, { status: 500 }), req.headers.get("origin"))
  }

  const hash = crypto
    .createHmac("sha512", webhookSecret)
    .update(body)
    .digest("hex")

  if (hash !== signature) {
    return addCorsHeaders(NextResponse.json({ error: "Invalid signature." }, { status: 401 }), req.headers.get("origin"))
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

  return addCorsHeaders(NextResponse.json({ received: true }), req.headers.get("origin"))
}