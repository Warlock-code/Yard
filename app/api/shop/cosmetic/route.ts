import { NextRequest, NextResponse } from "next/server"
import { prisma } from "@/lib/prisma"
import { getCurrentUser } from "@/lib/getCurrentUser"
import { initializePaystack } from "@/lib/paystack"
import { creditUser, toCreditErrorResponse } from "@/lib/credits"
import { AVATARS, isAvatarBuyable, isAvatarUnlockedForTier } from "@/lib/avatars"
import { getEffectiveTier } from "@/lib/tier"
import { calculateLevel, requiredLevelForAvatar } from "@/lib/levels"
import { userLevelInfo } from "@/lib/userLevel"

const COSMETICS = AVATARS

export const dynamic = "force-dynamic"

// Catalog with level gates so the shop can show "unlocked at level X"
// instead of a price for eligible items. Best-effort — never 500s.
export async function GET(req: NextRequest) {
  const user = await getCurrentUser(req)
  if (!user) return NextResponse.json({ error: "not authenticated." }, { status: 401 })
  try {
    const info = await userLevelInfo(user.id)
    const progress = calculateLevel(info.xp)
    return NextResponse.json({
      myLevel: progress.currentLevel,
      myXp: progress.currentXp,
      levelName: progress.levelName,
      nextLevelXp: progress.nextLevelXp,
      nextLevelName: progress.nextLevelName,
      progressPct: progress.progressPct,
      items: COSMETICS.map((c) => {
        const requiredLevel = requiredLevelForAvatar(c.id) ?? 1
        return {
          id: c.id,
          name: c.name,
          emoji: c.emoji,
          rarity: c.rarity,
          creditCost: Math.round(c.pricePesewas / 100),
          owned: user.ownedCosmetics.includes(c.id),
          tierIncluded: isAvatarUnlockedForTier(getEffectiveTier(user), c.id),
          levelUnlock: requiredLevel,
          levelUnlocked: progress.currentLevel >= requiredLevel,
          requiredLevel,
        }
      }),
    })
  } catch {
    return NextResponse.json({ myLevel: 1, myXp: 0, levelName: "Newbie", nextLevelXp: 100, nextLevelName: "Rising Ghost", progressPct: 0, items: [] })
  }
}

export async function POST(req: NextRequest) {
  const user = await getCurrentUser(req)
  if (!user) return NextResponse.json({ error: "not authenticated." }, { status: 401 })

  const body = await req.json().catch(() => ({}))
  const cosmeticId = typeof body.cosmeticId === "string" ? body.cosmeticId : ""
  const item = COSMETICS.find((c) => c.id === cosmeticId)
  if (!item) return NextResponse.json({ error: "invalid item." }, { status: 400 })
  if (!isAvatarBuyable(item)) {
    return NextResponse.json({ error: "this limited drop expired." }, { status: 410 })
  }

  if (user.ownedCosmetics.includes(cosmeticId)) {
    return NextResponse.json({ error: "already owned." }, { status: 400 })
  }

  // Tier-included avatars are never for sale — charging for them would bill
  // users for what their plan already gives. Effective tier honors grace.
  if (isAvatarUnlockedForTier(getEffectiveTier(user), cosmeticId)) {
    return NextResponse.json({ error: "included with your plan — find it in owned." }, { status: 400 })
  }

  // Ghost-level gate: the ladder unlocks the right to BUY a rarity tier —
  // it does not grant free items. Fail closed if the level lookup fails.
  const levelInfo = await userLevelInfo(user.id)
  const requiredLevel = requiredLevelForAvatar(cosmeticId) ?? 1
  if (levelInfo.progress.currentLevel < requiredLevel) {
    return NextResponse.json(
      { error: `unlocks at level ${requiredLevel}.`, requiredLevel, myLevel: levelInfo.progress.currentLevel },
      { status: 403 }
    )
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
      return toCreditErrorResponse(err, "couldn't buy the cosmetic.")
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