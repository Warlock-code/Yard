import { NextRequest, NextResponse } from "next/server"
import { prisma } from "@/lib/prisma"
import { getCurrentUser } from "@/lib/getCurrentUser"
import { getAllPacks, getPackById } from "@/lib/credits"
import { initializePaystack } from "@/lib/paystack"
import { reportServerError } from "@/lib/errorAlerts"

export async function GET() {
  const packs = getAllPacks()
  return NextResponse.json({ packs })
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
    const amountInPesewas = pack.ghs * 100
    const reference = `credits_${user.id}_${packId}_${Date.now()}`

    await prisma.transaction.create({
      data: {
        userId: user.id,
        kind: "credits",
        reference,
        amount: amountInPesewas,
        metadata: { packId, credits: pack.credits, ghsAmount: pack.ghs, bonusPct: pack.bonusPct },
      },
    })

    const payment = await initializePaystack(user.email, amountInPesewas, reference)

    return NextResponse.json({
      authorization_url: payment.data.authorization_url,
      reference: payment.data.reference,
      pack,
    })
  } catch (err) {
    await reportServerError({ route: "/api/credits/purchase", error: err, metadata: { packId } })
    return NextResponse.json({ error: "failed to initialize payment" }, { status: 500 })
  }
}