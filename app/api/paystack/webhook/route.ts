import { NextRequest, NextResponse } from "next/server"
import crypto from "crypto"
import { prisma } from "@/lib/prisma"
import { handleCors, addCorsHeaders } from "@/lib/cors"
import { validatePaystackCharge, fulfillPaidTransaction } from "@/lib/paystackFulfillment"
import { reportServerError } from "@/lib/errorAlerts"

type PaystackWebhookData = {
  reference?: string
  status?: string
  currency?: string
  amount?: number
  customer?: { email?: string }
  plan?: { plan_code?: string }
  authorization?: { plan?: string }
  plan_object?: { plan_code?: string }
  subscription?: { subscription_code?: string }
  subscription_code?: string
  [key: string]: unknown
}

type PaystackWebhookEvent = {
  event?: string
  data: PaystackWebhookData
}

export async function POST(req: NextRequest) {
  const corsPreflight = handleCors(req)
  if (corsPreflight) return corsPreflight

  const body = await req.text()
  const signature = req.headers.get("x-paystack-signature")

  const webhookSecret = process.env.PAYSTACK_SECRET_KEY
  if (!webhookSecret) {
    console.error("PAYSTACK_SECRET_KEY not configured")
    return addCorsHeaders(NextResponse.json({ error: "webhook not configured" }, { status: 500 }), req.headers.get("origin"))
  }

  const hash = crypto
    .createHmac("sha512", webhookSecret)
    .update(body)
    .digest("hex")

  const expected = Buffer.from(hash, "utf8")
  const received = Buffer.from(signature || "", "utf8")
  if (expected.length !== received.length || !crypto.timingSafeEqual(expected, received)) {
    return addCorsHeaders(NextResponse.json({ error: "invalid signature." }, { status: 401 }), req.headers.get("origin"))
  }

  let event: PaystackWebhookEvent
  try { event = JSON.parse(body) } catch {
    return addCorsHeaders(NextResponse.json({ error: "invalid JSON" }, { status: 400 }), req.headers.get("origin"))
  }

  try {
    if (event.event === "charge.success") {
      const reference = event.data.reference
      if (!reference) {
        return addCorsHeaders(NextResponse.json({ error: "missing payment reference" }, { status: 400 }), req.headers.get("origin"))
      }
      const tx = await prisma.transaction.findUnique({ where: { reference } })

      if (tx && tx.status !== "success") {
        await validatePaystackCharge(reference, event.data)
        await fulfillPaidTransaction(reference)
      } else if (!tx) {
        const email: string | undefined = event.data?.customer?.email?.toLowerCase()
        const planCode: string | undefined =
          event.data?.plan?.plan_code || event.data?.authorization?.plan || event.data?.plan_object?.plan_code
        const amount: number | undefined = event.data?.amount
        const subCode: string | undefined =
          event.data?.subscription?.subscription_code || event.data?.subscription_code
        const plusCode = process.env.PAYSTACK_PLUS_PLAN_CODE
        const primeCode = process.env.PAYSTACK_PRIME_PLAN_CODE
        const plusAmount = Number(process.env.PAYSTACK_PLUS_PRICE_PESEWAS || 1000)
        const primeAmount = Number(process.env.PAYSTACK_PRIME_PRICE_PESEWAS || 2000)
        const matchedTier =
          planCode === plusCode && amount === plusAmount ? "PLUS"
          : planCode === primeCode && amount === primeAmount ? "PRIME"
          : null
        const isValidRenewal =
          event.data?.status === "success" &&
          event.data?.currency === "GHS" &&
          typeof email === "string" &&
          typeof planCode === "string" &&
          typeof amount === "number" &&
          Number.isSafeInteger(amount) &&
          matchedTier !== null

        if (isValidRenewal) {
          const user = await prisma.user.findUnique({ where: { email } })
          if (user) {
            await prisma.transaction.create({
              data: {
                userId: user.id,
                kind: matchedTier === "PRIME" ? "prime" : "plus",
                reference,
                amount,
                status: "success",
                metadata: { tier: matchedTier === "PRIME" ? "prime" : "plus", paystackSubscriptionCode: subCode, renewal: true, autoDeduct: true },
              },
            })
            await prisma.$transaction(async (db) => {
              const current = await db.user.findUnique({ where: { id: user.id }, select: { tierExpiresAt: true } })
              const base = Math.max(Date.now(), current?.tierExpiresAt?.getTime() ?? 0)
              await db.user.update({
                where: { id: user.id },
                data: { tier: matchedTier as "PLUS" | "PRIME", tierExpiresAt: new Date(base + 31 * 24 * 60 * 60 * 1000) },
              })
            })
          }
        }
      }
    }

  if (event.event === "transfer.success" || event.event === "transfer.failed" || event.event === "transfer.reversed") {
    const trRef = event.data?.reference || ""
    if (typeof trRef === "string" && trRef.startsWith("payout_")) {
      // Legacy payouts table (kept for history).
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
      // Current credit payouts flow.
      const creditPayout = await prisma.creditPayout.findUnique({ where: { providerRef: trRef } })
      if (creditPayout && (creditPayout.status === "approved" || creditPayout.status === "processing")) {
        if (event.event === "transfer.success") {
          await prisma.creditPayout.update({ where: { id: creditPayout.id }, data: { status: "paid", processedAt: new Date() } })
        } else {
          // failed/reversed -> terminal, keep ref for audit. Refund credits manually via admin Credits if needed.
          await prisma.creditPayout.update({ where: { id: creditPayout.id }, data: { status: "rejected" } })
        }
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
  } catch (error) {
    await reportServerError({ route: "/api/paystack/webhook", error })
    return addCorsHeaders(NextResponse.json({ error: "webhook processing failed" }, { status: 500 }), req.headers.get("origin"))
  }

  return addCorsHeaders(NextResponse.json({ received: true }), req.headers.get("origin"))
}