import { NextRequest, NextResponse } from "next/server"
import { prisma } from "@/lib/prisma"
import { getCurrentUser } from "@/lib/getCurrentUser"
import { getAllPacks, getPackById } from "@/lib/credits"
import { packChargePesewas, CREDIT_CONFIG } from "@/lib/credit-config"
import { initializePaystack } from "@/lib/paystack"
import { reportServerError } from "@/lib/errorAlerts"

// First-buy promo: 20% off the first-ever credit pack. The SAME helper
// (packChargePesewas) drives GET display, POST charge, and the stored
// transaction amount, so display === charge by construction.
async function isFirstCreditPackPurchase(userId: string): Promise<boolean> {
  try {
    const prior = await prisma.transaction.findFirst({
      where: { userId, kind: "credits", status: "success" },
      select: { id: true },
    })
    return !prior
  } catch {
    // Fail closed (no discount) — never charge less than displayed.
    return false
  }
}

function pricedPacks(firstBuy: boolean) {
  return getAllPacks().map((pack) => {
    const chargePesewas = packChargePesewas(pack, firstBuy)
    return {
      ...pack,
      listPesewas: pack.ghs * 100,
      chargePesewas,
      effectiveGhs: chargePesewas / 100,
    }
  })
}

// Per-user pricing so the storefront renders the exact amount Paystack will
// charge. Unauthenticated callers get 401 — the shop fetches this per user.
export async function GET(req: NextRequest) {
  const user = await getCurrentUser(req)
  if (!user) return NextResponse.json({ error: "not authenticated." }, { status: 401 })

  const firstBuy = await isFirstCreditPackPurchase(user.id)
  return NextResponse.json({
    firstBuy,
    discountPct: CREDIT_CONFIG.FIRST_BUY_DISCOUNT_PCT,
    packs: pricedPacks(firstBuy),
  })
}

export async function POST(req: NextRequest) {
  const user = await getCurrentUser(req)
  if (!user) return NextResponse.json({ error: "not authenticated." }, { status: 401 })

  const body = await req.json().catch(() => ({}))
  const { packId } = body

  if (!packId || typeof packId !== "string") {
    return NextResponse.json({ error: "packId is required" }, { status: 400 })
  }

  const pack = getPackById(packId)
  if (!pack) {
    return NextResponse.json({ error: "invalid pack" }, { status: 400 })
  }

  try {
    const firstBuy = await isFirstCreditPackPurchase(user.id)
    const listPrice = pack.ghs * 100
    const amountInPesewas = packChargePesewas(pack, firstBuy)
    const reference = `credits_${user.id}_${packId}_${Date.now()}`

    await prisma.transaction.create({
      data: {
        userId: user.id,
        kind: "credits",
        reference,
        amount: amountInPesewas,
        metadata: { packId, credits: pack.credits, ghsAmount: pack.ghs, bonusPct: pack.bonusPct, firstBuy, listPrice },
      },
    })

    const payment = await initializePaystack(user.email, amountInPesewas, reference)

    return NextResponse.json({
      authorization_url: payment.data.authorization_url,
      reference: payment.data.reference,
      pack,
      firstBuy,
      amountCharged: amountInPesewas,
    })
  } catch (err) {
    await reportServerError({ route: "/api/credits/purchase", error: err, metadata: { packId } })
    return NextResponse.json({ error: "failed to initialize payment" }, { status: 500 })
  }
}
