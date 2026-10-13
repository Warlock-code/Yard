import { NextRequest, NextResponse } from "next/server"
import { prisma } from "@/lib/prisma"
import { getCurrentUser } from "@/lib/getCurrentUser"
import { initializePaystack } from "@/lib/paystack"
import { reportServerError } from "@/lib/errorAlerts"
import { trackFeatureEvent, CREDIT_CONFIG } from "@/lib/credits"

export const dynamic = "force-dynamic"

// Tier + credits bundles (cash upfront, one-time charge):
// PLUS + 1,100cr for GHS 20 · PRIME + 2,400cr for GHS 40.
const BUNDLES = {
  plus: { kind: "bundle_plus", ghs: 20, credits: 1_100, tier: "PLUS" },
  prime: { kind: "bundle_prime", ghs: 40, credits: 2_400, tier: "PRIME" },
} as const

export async function GET() {
  return NextResponse.json({
    bundles: Object.entries(BUNDLES).map(([id, b]) => ({ id, ...b })),
    packs: CREDIT_CONFIG.PACKS,
  })
}

export async function POST(req: NextRequest) {
  const user = await getCurrentUser(req)
  if (!user) return NextResponse.json({ error: "not authenticated." }, { status: 401 })

  const body = await req.json().catch(() => ({}))
  const bundleId = typeof body.bundle === "string" ? body.bundle.toLowerCase() : ""
  const bundle = BUNDLES[bundleId as keyof typeof BUNDLES]
  if (!bundle) return NextResponse.json({ error: "invalid bundle." }, { status: 400 })

  if (bundle.tier === "PLUS" && (user.tier === "PLUS" || user.tier === "PRIME")) {
    return NextResponse.json({ error: "already on Plus or higher." }, { status: 400 })
  }
  if (bundle.tier === "PRIME" && user.tier === "PRIME") {
    return NextResponse.json({ error: "already on Prime." }, { status: 400 })
  }

  const amountInPesewas = bundle.ghs * 100
  const reference = `bundle_${bundleId}_${user.id}_${Date.now()}`

  await prisma.transaction.create({
    data: {
      userId: user.id,
      kind: bundle.kind,
      reference,
      amount: amountInPesewas,
      metadata: { bundle: bundleId, tier: bundle.tier, credits: bundle.credits, ghsAmount: bundle.ghs },
    },
  })

  try {
    const payment = await initializePaystack(user.email, amountInPesewas, reference)
    await trackFeatureEvent({
      userId: user.id,
      type: "bundle_start",
      pathname: "/upgrade",
      metadata: { bundle: bundleId },
    })
    return NextResponse.json({
      authorization_url: payment.data.authorization_url,
      reference: payment.data.reference,
      bundle: { id: bundleId, ...bundle },
    })
  } catch (err) {
    await reportServerError({ route: "/api/bundles", error: err, metadata: { bundle: bundleId } })
    await prisma.transaction.updateMany({
      where: { reference, status: "pending" },
      data: { status: "failed" },
    }).catch(() => {})
    return NextResponse.json({ error: "failed to initialize payment" }, { status: 500 })
  }
}
