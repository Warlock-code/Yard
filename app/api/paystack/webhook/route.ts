import { NextRequest, NextResponse } from "next/server"
import crypto from "crypto"
import { prisma } from "@/lib/prisma"
import { createNotification } from "@/lib/notifications"
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
        const plusAnnualCode = process.env.PAYSTACK_PLUS_ANNUAL_PLAN_CODE
        const primeAnnualCode = process.env.PAYSTACK_PRIME_ANNUAL_PLAN_CODE
        const plusAmount = Number(process.env.PAYSTACK_PLUS_PRICE_PESEWAS || 1000)
        const primeAmount = Number(process.env.PAYSTACK_PRIME_PRICE_PESEWAS || 2000)
        const plusAnnualAmount = Number(process.env.PAYSTACK_PLUS_ANNUAL_PRICE_PESEWAS || 10000)
        const primeAnnualAmount = Number(process.env.PAYSTACK_PRIME_ANNUAL_PRICE_PESEWAS || 20000)
        // Monthly renewals extend 31d; annual renewals extend 365d. Unknown
        // plan/amount combos are ignored (never fulfill on guesswork).
        const matched: { tier: "PLUS" | "PRIME"; days: number; kind: string } | null =
          planCode === plusCode && amount === plusAmount ? { tier: "PLUS", days: 31, kind: "plus" }
          : planCode === primeCode && amount === primeAmount ? { tier: "PRIME", days: 31, kind: "prime" }
          : planCode === plusAnnualCode && amount === plusAnnualAmount ? { tier: "PLUS", days: 365, kind: "plus_annual" }
          : planCode === primeAnnualCode && amount === primeAnnualAmount ? { tier: "PRIME", days: 365, kind: "prime_annual" }
          : null
        const isValidRenewal =
          event.data?.status === "success" &&
          event.data?.currency === "GHS" &&
          typeof email === "string" &&
          typeof planCode === "string" &&
          typeof amount === "number" &&
          Number.isSafeInteger(amount) &&
          matched !== null

        if (isValidRenewal && matched) {
          const user = await prisma.user.findUnique({ where: { email } })
          if (user) {
            // Create the renewal as PENDING, then let the shared fulfillment
            // claim it and extend the tier in one transaction. Creating it as
            // success first meant a failure after the row insert left a paid
            // renewal that every retry skipped forever.
            await prisma.transaction.create({
              data: {
                userId: user.id,
                kind: matched.kind,
                reference,
                amount,
                status: "pending",
                metadata: { tier: matched.kind, paystackSubscriptionCode: subCode, renewal: true, autoDeduct: true },
              },
            })
            await fulfillPaidTransaction(reference)
          }
        }
      }
    }

  // NOTE: cash-payout transfers removed — credits are in-app only with no
  // monetary value. No transfer events are processed.

  if (event.event === "invoice.payment_failed" || event.event === "subscription.not_renew") {
    const email: string | undefined = event.data?.customer?.email?.toLowerCase()
    if (email) {
      const user = await prisma.user.findUnique({ where: { email } })
      if (user && user.tier !== "FREE") {
        try {
          await createNotification({
            userId: user.id,
            type: "subscription_payment_failed",
            title: "Auto-renew failed",
            body: "Your Yard subscription auto-deduct failed (MoMo/card). We'll retry for 3 days before downgrade. Update payment at yardapp.me/upgrade.",
            href: "/upgrade",
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