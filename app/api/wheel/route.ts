import { NextRequest, NextResponse } from "next/server"
import { prisma } from "@/lib/prisma"
import { getCurrentUser } from "@/lib/getCurrentUser"
import {
  creditUser,
  toCreditErrorResponse,
  trackFeatureEvent,
  CREDIT_CONFIG,
} from "@/lib/credits"
import {
  rollInt,
  rollWheelPaid,
  WHEEL_FREE_RANGE,
  WHEEL_PAID_RANGE,
  WHEEL_RARE_BONUS_CHANCE,
  WHEEL_RARE_BONUS_RANGE,
} from "@/lib/luck"

export const dynamic = "force-dynamic"

// Haunt wheel — daily habit spinner. Free spin 1/day (5–50cr). Paid spin
// 100cr draws from the rebalanced luck table in lib/luck.ts (EV ≈ 89.5cr,
// mostly 20–80, rare 1000 jackpot + 5% bonus credits). 10x bundle 950cr
// (EV ≈ 894.5 → still a credit sink). Prizes are credits only — permanent
// shop cosmetics are never granted here, so the wheel can't cannibalize
// shop sales. Free-spin claim is guarded by a unique RateLimit row per user
// per day, so double-taps can't double-claim.
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
    freeRange: WHEEL_FREE_RANGE,
    paidRange: WHEEL_PAID_RANGE,
    rareBonusChance: WHEEL_RARE_BONUS_CHANCE,
    rareBonusRange: WHEEL_RARE_BONUS_RANGE,
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
    const reward = rollInt(WHEEL_FREE_RANGE)
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

  const results: { reward: number; bonusCredits?: number }[] = []
  let total = 0
  let balance = 0
  try {
    for (let i = 0; i < spins; i++) {
      const reward = rollWheelPaid()
      const r = await creditUser(user.id, "WHEEL_WIN", reward, `${reference}_${i}`, { kind, reward })
      balance = r.newBalance
      total += reward
      const row: { reward: number; bonusCredits?: number } = { reward }
      // 5% bonus-credit drop per paid spin. Credits only — never shop
      // cosmetics, so a lucky spin can't remove items from the shop.
      if (Math.random() < WHEEL_RARE_BONUS_CHANCE) {
        const bonus = rollInt(WHEEL_RARE_BONUS_RANGE)
        try {
          const rb = await creditUser(user.id, "WHEEL_WIN", bonus, `${reference}_${i}_bonus`, {
            kind,
            reward: bonus,
            rareBonus: true,
          })
          balance = rb.newBalance
          total += bonus
          row.bonusCredits = bonus
        } catch {
          // bonus failures never break a paid spin — the base reward stands
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
