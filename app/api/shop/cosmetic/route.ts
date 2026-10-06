import { NextRequest, NextResponse } from "next/server"
import { prisma } from "@/lib/prisma"
import { getCurrentUser } from "@/lib/getCurrentUser"
import { initializePaystack } from "@/lib/paystack"
import { creditUser } from "@/lib/credits"
import { AVATARS, isAvatarUnlockedForTier } from "@/lib/avatars"
import { getEffectiveTier } from "@/lib/tier"

export const COSMETICS = AVATARS

export async function POST(req: NextRequest) {
  const user = await getCurrentUser(req)
  if (!user) return NextResponse.json({ error: "not authenticated." }, { status: 401 })

  const body = await req.json().catch(() => ({}))
  const cosmeticId = typeof body.cosmeticId === "string" ? body.cosmeticId : ""
  const item = COSMETICS.find((c) => c.id === cosmeticId)
  if (!item) return NextResponse.json({ error: "invalid item." }, { status: 400 })

  if (user.ownedCosmetics.includes(cosmeticId)) {
    return NextResponse.json({ error: "already owned." }, { status: 400 })
  }

  // Tier-included avatars are never for sale — charging for them would bill
  // users for what their plan already gives. Effective tier honors grace.
  if (isAvatarUnlockedForTier(getEffectiveTier(user), cosmeticId)) {
    return NextResponse.json({ error: "included with your plan — find it in owned." }, { status: 400 })
  }

  const useCredits = body.useCredits === true
  const creditCost = Math.round(item.pricePesewas / 100) // Convert pesewas to credits (100 pesewas = 1 credit)

  if (useCredits) {
    const reference = `cosmetic_${cosmeticId}_${user.id}_${Date.now()}`
    try {
      const result = await creditUser(user.id, "COSMETIC_BUY", -creditCost, reference, { cosmeticId, emoji: item.emoji })
      try {
        await prisma.user.update({
          where: { id: user.id },
          data: { ownedCosmetics: { push: cosmeticId } },
        })
      } catch {
        // Grant failed after deduct — refund so the user never pays for nothing.
        await creditUser(user.id, "COSMETIC_BUY", creditCost, `${reference}_refund`, { cosmeticId, refund: true }).catch(() => {})
        return NextResponse.json({ error: "purchase failed, credits refunded. try again." }, { status: 500 })
      }
      return NextResponse.json({ success: true, creditsUsed: creditCost, newBalance: result.newBalance, message: "cosmetic purchased with credits" })
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