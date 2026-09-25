import { NextRequest, NextResponse } from "next/server"
import { prisma } from "@/lib/prisma"
import { getCurrentUser } from "@/lib/getCurrentUser"
import { initializePaystack } from "@/lib/paystack"
import { creditUser, CREDIT_CONFIG } from "@/lib/credits"
import { AVATARS } from "@/lib/avatars"

export const COSMETICS = AVATARS

export async function POST(req: NextRequest) {
  const user = await getCurrentUser(req)
  if (!user) return NextResponse.json({ error: "Not authenticated." }, { status: 401 })

  const { cosmeticId } = await req.json()
  const item = COSMETICS.find((c) => c.id === cosmeticId)
  if (!item) return NextResponse.json({ error: "Invalid item." }, { status: 400 })

  if (user.ownedCosmetics.includes(cosmeticId)) {
    return NextResponse.json({ error: "Already owned." }, { status: 400 })
  }

  const body = await req.json().catch(() => ({}))
  const useCredits = body.useCredits === true
  const creditCost = Math.round(item.pricePesewas / 100) // Convert pesewas to credits (100 pesewas = 1 credit)

  if (useCredits) {
    try {
      const result = await creditUser(user.id, "COSMETIC_BUY", -creditCost, `cosmetic_${cosmeticId}_${user.id}_${Date.now()}`, { cosmeticId, emoji: item.emoji })
      return NextResponse.json({ success: true, creditsUsed: creditCost, newBalance: result.newBalance, message: "Cosmetic purchased with credits" })
    } catch (err) {
      return NextResponse.json({ error: err instanceof Error ? err.message : "Insufficient credits" }, { status: 400 })
    }
  }

  const reference = `cosmetic_${cosmeticId}_${user.id}_${Date.now()}`

  await prisma.transaction.create({
    data: {
      userId: user.id,
      kind: "cosmetic",
      reference,
      amount: item.pricePesewas,
      metadata: { cosmeticId, emoji: item.emoji },
    },
  })

  try {
    const payment = await initializePaystack(user.email, item.pricePesewas, reference)
    return NextResponse.json(payment)
  } catch (err) {
    await prisma.transaction.updateMany({ where: { reference, status: "pending" }, data: { status: "failed" } }).catch(() => {})
    console.error("[shop/cosmetic] init failed", err)
    return NextResponse.json({ error: err instanceof Error ? err.message : "Checkout failed" }, { status: 400 })
  }
}