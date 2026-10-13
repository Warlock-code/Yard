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

// Haunt wheel — daily habit spinner. Free spin 1/day (5–50cr). Paid spin
// 100cr (50–500cr + 5% rare avatar drop). 10x bundle 800cr. All credits-only,
// no cash value. Free-spin claim is guarded by a unique RateLimit row per
// user per day, so double-taps can't double-claim.
function roll(min: number, max: number) {
  return min + Math.floor(Math.random() * (max - min + 1))
}

function dayKey(d = new Date()) {
  return d.toISOString().slice(0, 10)
}

// Spec key: `wheel:{userId}:{date}`. Legacy `wheel_free:` keys (pre-E)
// are honored read-only so deploys never grant a double free spin.
function freeKey(userId: string, date: string) {
  return `wheel:${userId}:${date}`
}
function legacyFreeKey(userId: string, date: string) {
  return `wheel_free:${userId}:${date}`
}

async function freeClaimed(userId: string, date: string): Promise<boolean> {
  try {
    const [cur, legacy] = await Promise.all([
      prisma.rateLimit.findUnique({ where: { key: freeKey(userId, date) }, select: { id: true } }),
      prisma.rateLimit.findUnique({ where: { key: legacyFreeKey(userId, date) }, select: { id: true } }),
    ])
    return Boolean(cur ?? legacy)
  } catch {
    return false
  }
}

export async function GET(req: NextRequest) {
  const user = await getCurrentUser(req)
  if (!user) return NextResponse.json({ error: "not authenticated." }, { status: 401 })

  let freeAvailable = true
  try {
    freeAvailable = !(await freeClaimed(user.id, dayKey()))
  } catch {
    freeAvailable = true
  }

  return NextResponse.json({
    freeAvailable,
    spinCost: CREDIT_CONFIG.SPEND.WHEEL_SPIN,
    bundleCost: CREDIT_CONFIG.SPEND.WHEEL_BUNDLE_10,
    freeRange: [5, 50],
    paidRange: [50, 500],
  })
}

export async function POST(req: NextRequest) {
  const user = await getCurrentUser(req)
  if (!user) return NextResponse.json({ error: "not authenticated." }, { status: 401 })

  const body = await req.json().catch(() => ({}))
  const kind = body.kind === "paid" || body.kind === "bundle10" ? body.kind : "free"
  const spins = kind === "bundle10" ? 10 : 1

  if (kind === "free") {
    // Back-compat: a legacy-key claim also blocks (no double free spin).
    try {
      if (await freeClaimed(user.id, dayKey())) {
        return NextResponse.json({ error: "free spin already used today — come back tomorrow." }, { status: 400 })
      }
    } catch {
      // fail-open to the claim below
    }
    // Claim first (unique key) — a P2002 means already spun today.
    try {
      const expires = new Date()
      expires.setHours(23, 59, 59, 999)
      await prisma.rateLimit.create({
        data: { key: freeKey(user.id, dayKey()), hits: 1, expiresAt: expires },
      })
    } catch {
      return NextResponse.json({ error: "free spin already used today — come back tomorrow." }, { status: 400 })
    }
    const reward = roll(5, 50)
    try {
      const r = await creditUser(user.id, "WHEEL_WIN", reward, `wheel_free_${dayKey()}`, {
        kind: "free",
        reward,
      })
      await trackFeatureEvent({ userId: user.id, type: "wheel_spin", metadata: { kind, reward } })
      return NextResponse.json({ success: true, kind, spins: [{ reward }], total: reward, newBalance: r.newBalance })
    } catch (err) {
      return NextResponse.json({ error: "spin failed. try again." }, { status: 500 })
    }
  }

  const cost = kind === "bundle10" ? CREDIT_CONFIG.SPEND.WHEEL_BUNDLE_10 : CREDIT_CONFIG.SPEND.WHEEL_SPIN
  const reference = `wheel_${kind}_${user.id}_${Date.now()}`
  try {
    await creditUser(user.id, "WHEEL_SPIN", -cost, reference, { kind, spins })
  } catch (err) {
    return toCreditErrorResponse(err, "not enough credits for a spin.")
  }

  const results: { reward: number; rareDrop?: string; rareKind?: "avatar" | "theme" }[] = []
  let total = 0
  let balance = 0
  try {
    for (let i = 0; i < spins; i++) {
      const reward = roll(50, 500)
      const r = await creditUser(user.id, "WHEEL_WIN", reward, `${reference}_${i}`, { kind, reward })
      balance = r.newBalance
      total += reward
      const row: { reward: number; rareDrop?: string; rareKind?: "avatar" | "theme" } = { reward }
      // 5% rare avatar/theme drop per paid spin.
      if (Math.random() < 0.05) {
        const drop = await grantRareDrop(user.id, "wheel_drop").catch(() => null)
        if (drop) {
          row.rareDrop = drop.id
          row.rareKind = drop.kind
        }
      }
      results.push(row)
    }
  } catch (err) {
    return NextResponse.json({ error: "spin failed mid-way — kept what you won so far.", status: 500, spins: results, total })
  }

  await trackFeatureEvent({ userId: user.id, type: "wheel_spin", metadata: { kind, spins, total } })
  return NextResponse.json({ success: true, kind, spins: results, total, newBalance: balance })
}

// Rare drop: locked rare/epic avatar OR locked purchasable theme, granted
// via ownedCosmetics. Shared shape with mystery-box (kept local: this route
// is Workstream E owned; no cross-workstream helper edits).
async function grantRareDrop(
  userId: string,
  notifType: "wheel_drop" | "mystery_drop"
): Promise<{ id: string; kind: "avatar" | "theme" } | null> {
  const u = await prisma.user.findUnique({
    where: { id: userId },
    select: { ownedCosmetics: true, ghostId: true },
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
    type: notifType,
    title: "🎁 rare drop from the haunt wheel!",
    body: `you unlocked the ${pick.label} ${pick.kind}. find it in owned.`,
    href: "/lair",
  }).catch(() => {})
  return { id: pick.id, kind: pick.kind }
}
