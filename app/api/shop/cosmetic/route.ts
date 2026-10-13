import { NextRequest, NextResponse } from "next/server"
import { prisma } from "@/lib/prisma"
import { getCurrentUser } from "@/lib/getCurrentUser"
import { initializePaystack } from "@/lib/paystack"
import { creditUser, toCreditErrorResponse, trackFeatureEvent } from "@/lib/credits"
import { AVATARS, isAvatarBuyable, isAvatarUnlockedForTier } from "@/lib/avatars"
import { getEffectiveTier } from "@/lib/tier"
import { userLevelInfo, levelUnlockLevel } from "@/lib/levels"

const COSMETICS = AVATARS

export const dynamic = "force-dynamic"

// Catalog with level gates so the shop can show "unlocked at level X"
// instead of a price for eligible items. Best-effort — never 500s.
export async function GET(req: NextRequest) {
  const user = await getCurrentUser(req)
  if (!user) return NextResponse.json({ error: "not authenticated." }, { status: 401 })
  try {
    const info = await userLevelInfo(user.id)
    return NextResponse.json({
      myLevel: info.level.level,
      myXp: info.xp,
      items: COSMETICS.map((c) => ({
        id: c.id,
        name: c.name,
        emoji: c.emoji,
        rarity: c.rarity,
        creditCost: Math.round(c.pricePesewas / 100),
        owned: user.ownedCosmetics.includes(c.id),
        tierIncluded: isAvatarUnlockedForTier(getEffectiveTier(user), c.id),
        levelUnlock: levelUnlockLevel(c.id),
        levelUnlocked: info.avatarIds.includes(c.id),
      })),
    })
  } catch {
    return NextResponse.json({ myLevel: 1, myXp: 0, items: [] })
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

  // Ghost-level grants: reaching the unlock level makes the avatar FREE
  // (pushed to ownedCosmetics, no charge, no ledger row — no credits move,
  // same as tier-included grants). Purchases are never removed.
  const levelInfo = await userLevelInfo(user.id).catch(() => null)
  if (levelInfo && levelInfo.avatarIds.includes(cosmeticId)) {
    try {
      const fresh = await prisma.user.findUnique({
        where: { id: user.id },
        select: { ownedCosmetics: true },
      })
      if (!(fresh?.ownedCosmetics || []).includes(cosmeticId)) {
        await prisma.user.update({
          where: { id: user.id },
          data: { ownedCosmetics: { push: cosmeticId } },
        })
      }
      await trackFeatureEvent({
        userId: user.id,
        type: "level_unlock",
        metadata: { cosmeticId, level: levelInfo.level.level },
      }).catch(() => {})
      return NextResponse.json({ success: true, granted: true, level: levelInfo.level.level, message: "unlocked by ghost level!" })
    } catch {
      return NextResponse.json({ error: "unlock failed. try again." }, { status: 500 })
    }
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