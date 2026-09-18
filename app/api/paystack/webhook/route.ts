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

  let event: any
  try { event = JSON.parse(body) } catch { return addCorsHeaders(NextResponse.json({ error: "Invalid JSON" }, { status: 400 }), req.headers.get("origin")) }

  if (event.event === "charge.success") {
    const reference = event.data.reference
    const tx = await prisma.transaction.findUnique({ where: { reference } })

    if (tx && tx.status !== "success") {
      // For subscriptions, Paystack amount is source of truth — correct legacy 0 amounts so admin revenue is accurate
      if ((tx.kind === "plus" || tx.kind === "prime") && Number.isSafeInteger(event.data?.amount) && event.data.amount !== tx.amount) {
        await prisma.transaction.update({ where: { reference }, data: { amount: event.data.amount } })
      }
      await fulfillPaidTransaction(reference)
    } else if (!tx) {
      // Renewal auto-deduct: Paystack creates new charge with fresh reference for monthly subscription
      // No pending Transaction exists — create one and extend tier frictionlessly
      const email: string | undefined = event.data?.customer?.email?.toLowerCase()
      const planCode: string | undefined = event.data?.plan?.plan_code || event.data?.authorization?.plan || event.data?.plan_object?.plan_code
      const amount: number | undefined = event.data?.amount
      const subCode: string | undefined = event.data?.subscription?.subscription_code || event.data?.subscription_code
      if (email && planCode && Number.isSafeInteger(amount)) {
        const primeCode = process.env.PAYSTACK_PRIME_PLAN_CODE
        const plusCode = process.env.PAYSTACK_PLUS_PLAN_CODE
        let tier: string | null = null
        if (planCode === primeCode) tier = "prime"
        else if (planCode === plusCode) tier = "plus"
        if (tier) {
          const user = await prisma.user.findUnique({ where: { email } })
          if (user) {
            const exists = await prisma.transaction.findUnique({ where: { reference } })
            if (!exists) {
              await prisma.transaction.create({
                data: {
                  userId: user.id,
                  kind: tier,
                  reference,
                  amount: amount as number,
                  status: "success",
                  metadata: { tier, paystackSubscriptionCode: subCode, renewal: true, autoDeduct: true },
                },
              })
              // Extend tier from max(now, current expiry) — no friction, user keeps perks
              await prisma.$transaction(async (db) => {
                const u = await db.user.findUnique({ where: { id: user.id }, select: { tierExpiresAt: true } })
                const base = Math.max(Date.now(), u?.tierExpiresAt?.getTime() ?? 0)
                const next = new Date(base + 31 * 24 * 60 * 60 * 1000)
                await db.user.update({ where: { id: user.id }, data: { tier: tier!.toUpperCase() as any, tierExpiresAt: next } })
              })
            }
          }
        }
      }
    }
  }

  if (event.event === "transfer.success" || event.event === "transfer.failed" || event.event === "transfer.reversed") {
    const trRef = event.data?.reference || ""
    if (typeof trRef === "string" && trRef.startsWith("payout_")) {
      const payout = await prisma.payout.findUnique({ where: { providerTransferRef: trRef } })
      if (payout && (payout.status === "approved" || payout.status === "processing")) {
        if (event.event === "transfer.success") {
          await prisma.payout.update({ where: { id: payout.id }, data: { status: "paid", processedAt: new Date() } })
        } else {
          // failed/reversed -> allow retry by reverting to pending (keep ref for audit)
          await prisma.payout.update({ where: { id: payout.id }, data: { status: "rejected" } })
        }
      } else if (payout && payout.status === "paid" && event.event === "transfer.failed") {
        // ignore late failure after paid
      }
    }
  }

  if (event.event === "invoice.payment_failed" || event.event === "subscription.not_renew") {
    const email: string | undefined = event.data?.customer?.email?.toLowerCase()
    if (email) {
      const user = await prisma.user.findUnique({ where: { email } })
      if (user && user.tier !== "FREE") {
        try {
          await prisma.notification.create({
            data: {
              userId: user.id,
              type: "subscription_payment_failed",
              title: "Auto-renew failed",
              body: "Your Yard subscription auto-deduct failed (MoMo/card). We'll retry for 3 days before downgrade. Update payment at yardapp.me/upgrade.",
              href: "/upgrade",
            },
          })
        } catch {}
      }
    }
  }

  if (event.event === "subscription.disable") {
    const email: string | undefined = event.data?.customer?.email?.toLowerCase()
    if (email) {
      const user = await prisma.user.findUnique({ where: { email }, select: { tierExpiresAt: true, tier: true, id: true } })
      if (user) {
        // Keep tier until expiry (grace) — only clear if already expired, else keep perks until tierExpiresAt
        if (!user.tierExpiresAt || user.tierExpiresAt.getTime() <= Date.now()) {
          await prisma.user.update({ where: { id: user.id }, data: { tier: "FREE", tierExpiresAt: null } })
        }
      }
    }
  }

  return addCorsHeaders(NextResponse.json({ received: true }), req.headers.get("origin"))
}