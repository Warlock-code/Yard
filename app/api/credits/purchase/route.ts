import { NextRequest, NextResponse } from "next/server"
import { getCurrentUser } from "@/lib/getCurrentUser"
import { getAllPacks, getPackById } from "@/lib/credits"
import { initializePaystack } from "@/lib/paystack"

export async function GET() {
  const packs = getAllPacks()
  return NextResponse.json({ packs })
}

export async function POST(req: NextRequest) {
  const user = await getCurrentUser(req)
  if (!user) return NextResponse.json({ error: "Not authenticated." }, { status: 401 })

  const body = await req.json().catch(() => ({}))
  const { packId } = body

  if (!packId || typeof packId !== "string") {
    return NextResponse.json({ error: "packId is required" }, { status: 400 })
  }

  const pack = getPackById(packId)
  if (!pack) {
    return NextResponse.json({ error: "Invalid pack" }, { status: 400 })
  }

try {
    const amountInPesewas = pack.ghs * 100
    const reference = `credits_${user.id}_${packId}_${Date.now()}`

    const payment = await initializePaystack(user.email, amountInPesewas, reference)

    return NextResponse.json({
      authorization_url: payment.data.authorization_url,
      reference: payment.data.reference,
      pack,
    })
  } catch (err) {
    console.error("[credits/purchase] error", err)
    return NextResponse.json({ error: "Failed to initialize payment" }, { status: 500 })
  }
}