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

// Mystery box — 100cr, random reward 10–500cr + 8% rare avatar/theme drop.
// Weighted tiers (house margin by design):
//   50% → 10–70 (avg 40) · 27% → 70–160 (avg 115) · 14% → 160–300 (avg 230)
//   7% → 300–450 (avg 375) · 2% → 450–500 (avg 475)
// EV ≈ 0.50*40 + 0.27*115 + 0.14*230 + 0.07*375 + 0.02*475
//    ≈ 20 + 31.05 + 32.2 + 26.25 + 9.5 ≈ 119cr on a 100cr box.
// Credits-only, no cash value.
function roll(min: number, max: number) {
  return min + Math.floor(Math.random() * (max - min + 1))
}

function rollBox(): number {
  const r = Math.random()
  if (r < 0.5) return roll(10, 70)
  if (r < 0.77) return roll(70, 160)
  if (r < 0.91) return roll(160, 300)
  if (r < 0.98) return roll(300, 450)
  return roll(450, 500)
}

export async function GET() {
  return NextResponse.json({
    cost: CREDIT_CONFIG.SPEND.MYSTERY_BOX,
    min: 10,
    max: 500,
    ev: 119,
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
