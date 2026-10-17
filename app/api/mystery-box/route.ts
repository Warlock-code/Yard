import { NextRequest, NextResponse } from "next/server"
import { getCurrentUser } from "@/lib/getCurrentUser"
import {
  creditUser,
  toCreditErrorResponse,
  trackFeatureEvent,
  CREDIT_CONFIG,
} from "@/lib/credits"
import { rollInt, BOX_RARE_BONUS_CHANCE, BOX_RARE_BONUS_RANGE } from "@/lib/luck"

export const dynamic = "force-dynamic"

// Mystery box — 100cr, random reward 10–410cr + 8% bonus credits (50–150cr).
// Weighted tiers (house margin by design — EV is deliberately BELOW cost so
// the box is a credit sink, not a faucet):
//   56% → 10–60 (avg 35) · 25% → 60–125 (avg 92.5) · 11.5% → 125–225 (avg 175)
//   5.5% → 225–330 (avg 277.5) · 2% → 330–410 (avg 370)
// EV ≈ 0.56*35 + 0.25*92.5 + 0.115*175 + 0.055*277.5 + 0.02*370 ≈ 85.5cr base
//    + 8% × avg(50,150)=100 → ≈ 93.5cr total on a 100cr box (~6.5% house edge).
// Prizes are credits only — permanent shop cosmetics are never granted here,
// so the box can't cannibalize shop sales. Credits-only, no cash value.
function rollBox(): number {
  const r = Math.random()
  if (r < 0.56) return rollInt([10, 60])
  if (r < 0.81) return rollInt([60, 125])
  if (r < 0.925) return rollInt([125, 225])
  if (r < 0.98) return rollInt([225, 330])
  return rollInt([330, 410])
}

export async function GET() {
  return NextResponse.json({
    cost: CREDIT_CONFIG.SPEND.MYSTERY_BOX,
    min: 10,
    max: 410,
    ev: 93.5,
    rareChance: BOX_RARE_BONUS_CHANCE,
    rareKinds: ["credits"] as const,
    rareBonusRange: BOX_RARE_BONUS_RANGE,
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

  // 8% bonus-credit drop. Credits only — never shop cosmetics.
  let bonusCredits = 0
  if (Math.random() < BOX_RARE_BONUS_CHANCE) {
    const bonus = rollInt(BOX_RARE_BONUS_RANGE)
    try {
      const rb = await creditUser(user.id, "MYSTERY_WIN", bonus, `${reference}_bonus`, {
        reward: bonus,
        rareBonus: true,
      })
      newBalance = rb.newBalance
      bonusCredits = bonus
    } catch {
      // bonus failures never break an opened box — the base reward stands
      bonusCredits = 0
    }
  }

  await trackFeatureEvent({ userId: user.id, type: "mystery_box", metadata: { cost, reward, bonusCredits } })
  return NextResponse.json({
    success: true,
    cost,
    reward,
    bonusCredits,
    total: reward + bonusCredits,
    newBalance,
  })
}
