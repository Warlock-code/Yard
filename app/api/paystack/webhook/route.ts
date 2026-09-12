import { NextRequest, NextResponse } from "next/server"
import crypto from "crypto"
import { prisma } from "@/lib/prisma"

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
      const tier = (tx.metadata as any)?.tier

      await prisma.$transaction([
        prisma.transaction.update({ where: { reference }, data: { status: "success" } }),
        ...(tier
          ? [
              prisma.user.update({
                where: { id: tx.userId },
                data: {
                  tier: tier.toUpperCase() as "PLUS" | "PRIME",
                  tierExpiresAt: new Date(Date.now() + 31 * 24 * 60 * 60 * 1000),
                },
              }),
            ]
          : []),
      ])
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