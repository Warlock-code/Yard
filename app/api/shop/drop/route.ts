// Weekly limited-drop store — sells the current getWeeklyDrop() rotation
// item. Live 48h window (Mon 00:00 → Wed 00:00 UTC) charges priceCredits;
// after expiry the same item costs afterPriceCredits (2×). Credits-only.
// Grants avatar IDs or theme_{id} into ownedCosmetics with the standard
// deduct-then-grant + refund pattern. Broadcasts fire once per drop via the
// drop_live:{id} notification dedupe in /api/cron/daily-engagement §9.
import { NextRequest, NextResponse } from "next/server"
import { prisma } from "@/lib/prisma"
import { getCurrentUser } from "@/lib/getCurrentUser"
import {
  creditUser,
  toCreditErrorResponse,
  trackFeatureEvent,
} from "@/lib/credits"
import { getWeeklyDrop } from "@/lib/credit-config"
import { AVATAR_MAP, isAvatarBuyable } from "@/lib/avatars"
import { THEME_MAP, isThemeBuyable, themeCosmeticId, type ThemeId } from "@/lib/themes"

export const dynamic = "force-dynamic"

export async function GET(req: NextRequest) {
  const user = await getCurrentUser(req)
  if (!user) return NextResponse.json({ error: "not authenticated." }, { status: 401 })
  const now = new Date()
  const drop = getWeeklyDrop(now)
  const live = now.getTime() < drop.endsAt.getTime()
  return NextResponse.json({
    drop: {
      id: drop.id,
      kind: drop.kind,
      name: drop.name,
      isLimited: drop.isLimited,
      live,
      endsAt: drop.endsAt,
      price: live ? drop.priceCredits : drop.afterPriceCredits,
    },
  })
}

export async function POST(req: NextRequest) {
  const user = await getCurrentUser(req)
  if (!user) return NextResponse.json({ error: "not authenticated." }, { status: 401 })

  const now = new Date()
  const drop = getWeeklyDrop(now)
  const live = now.getTime() < drop.endsAt.getTime()
  const cost = live ? drop.priceCredits : drop.afterPriceCredits

  // Resolve the grant target + honor static limited flags on the underlying
  // item (expired one-off limiteds stay dead even inside the rotation).
  let grantId: string
  if (drop.kind === "avatar") {
    const item = AVATAR_MAP[drop.cosmeticId]
    if (!item || !isAvatarBuyable(item)) {
      return NextResponse.json({ error: "this drop is no longer available." }, { status: 410 })
    }
    grantId = item.id
  } else {
    if (!drop.cosmeticId.startsWith("theme_")) {
      return NextResponse.json({ error: "this drop is no longer available." }, { status: 410 })
    }
    const themeId = drop.cosmeticId.slice("theme_".length) as ThemeId
    const theme = THEME_MAP[themeId]
    if (!theme || !isThemeBuyable(theme)) {
      return NextResponse.json({ error: "this drop is no longer available." }, { status: 410 })
    }
    grantId = themeCosmeticId(themeId)
  }

  if ((user.ownedCosmetics || []).includes(grantId)) {
    return NextResponse.json({ success: true, alreadyOwned: true })
  }

  const reference = `drop_${drop.id}_${user.id}_${Date.now()}`
  try {
    const r = await creditUser(user.id, "COSMETIC_BUY", -cost, reference, {
      dropId: drop.id,
      kind: drop.kind,
      live,
    })
    try {
      const fresh = await prisma.user.findUnique({
        where: { id: user.id },
        select: { ownedCosmetics: true },
      })
      if (!(fresh?.ownedCosmetics || []).includes(grantId)) {
        await prisma.user.update({
          where: { id: user.id },
          data: { ownedCosmetics: { push: grantId } },
        })
      }
    } catch {
      await creditUser(user.id, "COSMETIC_BUY", cost, `${reference}_refund`, {
        dropId: drop.id,
        refund: true,
      }).catch(() => {})
      return NextResponse.json({ error: "purchase failed, credits refunded. try again." }, { status: 500 })
    }
    await trackFeatureEvent({ userId: user.id, type: "drop_buy", metadata: { dropId: drop.id, cost, live } }).catch(() => {})
    return NextResponse.json({ success: true, dropId: drop.id, cost, live, newBalance: r.newBalance })
  } catch (err) {
    return toCreditErrorResponse(err, "drop purchase failed.")
  }
}
