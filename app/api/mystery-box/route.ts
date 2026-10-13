import { NextRequest, NextResponse } from "next/server"
import { prisma } from "@/lib/prisma"
import { getCurrentUser } from "@/lib/getCurrentUser"
import { AVATARS } from "@/lib/avatars"
import {
  creditUser,
  toCreditErrorResponse,
  trackFeatureEvent,
  CREDIT_CONFIG,
} from "@/lib/credits"

export const dynamic = "force-dynamic"

// Mystery box — 100cr, random reward 10–410cr + 8% rare avatar/theme drop.
// Weighted tiers (house margin by design — EV is deliberately BELOW cost so
// the box is a credit sink, not a faucet):
//   56% → 10–60 (avg 35) · 25% → 60–125 (avg 92.5) · 11.5% → 125–225 (avg 175)
//   5.5% → 225–330 (avg 277.5) · 2% → 330–410 (avg 370)
// EV ≈ 0.56*35 + 0.25*92.5 + 0.115*175 + 0.055*277.5 + 0.02*370
//    ≈ 19.6 + 23.13 + 20.13 + 15.26 + 7.4 ≈ 85cr on a 100cr box.
// Rare cosmetics (8%) are non-fungible — no credit emission.
// Credits-only, no cash value.
function roll(min: number, max: number) {
  return min + Math.floor(Math.random() * (max - min + 1))
}

function rollBox(): number {
  const r = Math.random()
  if (r < 0.56) return roll(10, 60)
  if (r < 0.81) return roll(60, 125)
  if (r < 0.925) return roll(125, 225)
  if (r < 0.98) return roll(225, 330)
  return roll(330, 410)
}

export async function GET() {
  return NextResponse.json({
    cost: CREDIT_CONFIG.SPEND.MYSTERY_BOX,
    min: 10,
    max: 410,
    ev: 85,
    rareChance: 0.08,
    rareKinds: ["avatar", "theme"] as const,
  })
}

export async function POST(req: NextRequest) {
  const user = await getCurrentUser(req)
  if (!user) return NextResponse.json({ error: "not authenticated." }, { status: 401 })

  const cost = CREDIT_CONFIG.SPEND.MYSTERY_BOX
  const reference = `mbox_${user.id}_${Date.now()}`
  try {
    await creditUser(user.id, "MYSTERY_BOX", -cost, reference, {})
  } catch (err) {
    return toCreditErrorResponse(err, "not enough credits for a mystery box.")
  }

  const reward = rollBox()
  let newBalance = 0
  try {
    const r = await creditUser(user.id, "MYSTERY_WIN", reward, `${reference}_win`, { reward })
    newBalance = r.newBalance
  } catch {
    // Win credit failed — refund the box cost so the user never pays for nothing.
    await creditUser(user.id, "MYSTERY_BOX", cost, `${reference}_refund`, { refund: true }).catch(() => {})
    return NextResponse.json({ error: "box failed to open — cost refunded." }, { status: 500 })
  }

  let rareDrop: { id: string; kind: "avatar" | "theme" } | null = null
  if (Math.random() < 0.08) {
    rareDrop = await grantRareDrop(user.id).catch(() => null)
  }

  await trackFeatureEvent({ userId: user.id, type: "mystery_box", metadata: { cost, reward, rareDrop } })
  return NextResponse.json({ success: true, cost, reward, rareDrop: rareDrop?.id ?? null, rareKind: rareDrop?.kind ?? null, newBalance })
}

// Rare drop: locked rare/epic avatar OR locked purchasable theme, granted
// via ownedCosmetics. (Same shape as wheel; kept local to Workstream E files.)
async function grantRareDrop(userId: string): Promise<{ id: string; kind: "avatar" | "theme" } | null> {
  const u = await prisma.user.findUnique({
    where: { id: userId },
    select: { ownedCosmetics: true },
  })
  if (!u) return null
  const lockedAvatars = AVATARS.filter((a) => !u.ownedCosmetics.includes(a.id) && (a.rarity === "rare" || a.rarity === "epic"))
  let lockedThemes: { cosmeticId: string; name: string }[] = []
  try {
    const { getPurchasableThemes, themeCosmeticId } = await import("@/lib/themes")
    lockedThemes = getPurchasableThemes()
      .filter((t) => !u.ownedCosmetics.includes(themeCosmeticId(t.id)))
      .map((t) => ({ cosmeticId: themeCosmeticId(t.id), name: t.name }))
  } catch {
    lockedThemes = []
  }
  const pool: { id: string; kind: "avatar" | "theme"; label: string }[] = [
    ...lockedAvatars.map((a) => ({ id: a.id, kind: "avatar" as const, label: a.name })),
    ...lockedThemes.map((t) => ({ id: t.cosmeticId, kind: "theme" as const, label: t.name })),
  ]
  if (pool.length === 0) return null
  const pick = pool[Math.floor(Math.random() * pool.length)]
  await prisma.user.update({ where: { id: userId }, data: { ownedCosmetics: { push: pick.id } } })
  const { createNotification } = await import("@/lib/notifications")
  await createNotification({
    userId,
    type: "mystery_drop",
    title: "🎁 mystery box dropped something rare!",
    body: `you unlocked the ${pick.label} ${pick.kind}. find it in owned.`,
    href: "/lair",
  }).catch(() => {})
  return { id: pick.id, kind: pick.kind }
}
