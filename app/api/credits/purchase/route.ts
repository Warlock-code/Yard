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

  // First-buy discount: 20% off the first-ever credit pack. Credits granted
  // stay the same — only the Paystack charge drops. Stored amount is the
  // discounted one so webhook validation matches exactly.
  let firstBuy = false
  try {
    const prior = await prisma.transaction.findFirst({
      where: { userId: user.id, kind: "credits", status: "success" },
      select: { id: true },
    })
    firstBuy = !prior
  } catch {
    firstBuy = false
  }

try {
    const listPrice = pack.ghs * 100
    const amountInPesewas = firstBuy ? Math.round(listPrice * 0.8) : listPrice
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