// Profile customization pack — banner / color name / animated frame / bundle.
// Credits-only, anonymous-safe (visual flair on the public ghost identity).
// Items land in User.ownedCosmetics[]; deduct-then-grant with refund on
// failure, same pattern as the other shop routes.
import { NextRequest, NextResponse } from "next/server"
import { prisma } from "@/lib/prisma"
import { getCurrentUser } from "@/lib/getCurrentUser"
import {
  creditUser,
  toCreditErrorResponse,
  trackFeatureEvent,
  CREDIT_CONFIG,
} from "@/lib/credits"
import { goldNameFlag, profilePerkActive, IDENTITY_UNLOCK_LEVEL } from "@/lib/levels"
import { userLevelInfo } from "@/lib/userLevel"

export const dynamic = "force-dynamic"

const GOLD_NAME_MS = 30 * 24 * 60 * 60 * 1000

const ITEMS = {
  banner: { key: "banner", cost: CREDIT_CONFIG.SPEND.PROFILE_BANNER },
  color_name: { key: "color_name", cost: CREDIT_CONFIG.SPEND.PROFILE_COLOR_NAME },
  frame: { key: "frame", cost: CREDIT_CONFIG.SPEND.PROFILE_FRAME },
  bundle: { key: "bundle", cost: CREDIT_CONFIG.SPEND.PROFILE_BUNDLE },
} as const

type ItemId = keyof typeof ITEMS | "gold_name"

function ownedKey(item: keyof typeof ITEMS) {
  return `profile:${ITEMS[item].key}`
}

function bundleGrants(): string[] {
  return [ownedKey("banner"), ownedKey("color_name"), ownedKey("frame")]
}

export async function POST(req: NextRequest) {
  const user = await getCurrentUser(req)
  if (!user) return NextResponse.json({ error: "not authenticated." }, { status: 401 })

  const body = await req.json().catch(() => ({}))
  const item = (typeof body.item === "string" ? body.item : "") as ItemId
  if (item !== "gold_name" && !ITEMS[item as keyof typeof ITEMS]) {
    return NextResponse.json({ error: "invalid item. choose banner, color_name, frame, gold_name, or bundle." }, { status: 400 })
  }

  // Identity items share the Level 5 gate. Gold name is a Level 6 perk and
  // is checked separately below.
  const levelInfo = await userLevelInfo(user.id)
  if (item !== "gold_name" && levelInfo.progress.currentLevel < IDENTITY_UNLOCK_LEVEL) {
    return NextResponse.json(
      { error: `identity items unlock at level ${IDENTITY_UNLOCK_LEVEL}.`, requiredLevel: IDENTITY_UNLOCK_LEVEL, myLevel: levelInfo.progress.currentLevel },
      { status: 403 }
    )
  }

  // Legend perk: gold name color free for 30 days (level 6+ only). No
  // credits move, so no ledger row — same as tier grants. Time-boxed via a
  // `profile:color_name:gold:{expiry}` flag; renderers must honor expiry via
  // profilePerkActive() in lib/levels.ts.
  if (item === "gold_name") {
    if (!levelInfo.perks.includes("gold_name_30d")) {
      return NextResponse.json({ error: "reach legend (level 6) to claim the gold name." }, { status: 403 })
    }
    if (profilePerkActive(user.ownedCosmetics || [], "profile:color_name")) {
      return NextResponse.json({ success: true, alreadyOwned: true })
    }
    const until = Date.now() + GOLD_NAME_MS
    try {
      await prisma.user.update({
        where: { id: user.id },
        data: { ownedCosmetics: { push: goldNameFlag(until) } },
      })
    } catch {
      return NextResponse.json({ error: "claim failed. try again." }, { status: 500 })
    }
    await trackFeatureEvent({ userId: user.id, type: "level_unlock", metadata: { item: "gold_name", level: 6 } }).catch(() => {})
    return NextResponse.json({ success: true, item, granted: true, until })
  }

  const grants = item === "bundle" ? bundleGrants() : [ownedKey(item as keyof typeof ITEMS)]
  const owned = user.ownedCosmetics || []
  if (grants.every((k) => owned.includes(k))) {
    return NextResponse.json({ success: true, alreadyOwned: true })
  }

  const cost = ITEMS[item as keyof typeof ITEMS].cost
  const reference = `profilecustom_${item}_${user.id}_${Date.now()}`
  try {
    const r = await creditUser(user.id, "COSMETIC_BUY", -cost, reference, { item })
    try {
      const fresh = await prisma.user.findUnique({
        where: { id: user.id },
        select: { ownedCosmetics: true },
      })
      const missing = grants.filter((k) => !(fresh?.ownedCosmetics || []).includes(k))
      if (missing.length > 0) {
        await prisma.user.update({
          where: { id: user.id },
          data: { ownedCosmetics: { push: missing } },
        })
      }
    } catch {
      await creditUser(user.id, "COSMETIC_BUY", cost, `${reference}_refund`, { item, refund: true }).catch(() => {})
      return NextResponse.json({ error: "purchase failed, credits refunded. try again." }, { status: 500 })
    }
    await trackFeatureEvent({ userId: user.id, type: "profile_custom", metadata: { item, cost } }).catch(() => {})
    return NextResponse.json({ success: true, item, newBalance: r.newBalance })
  } catch (err) {
    return toCreditErrorResponse(err, "customization costs credits.")
  }
}
