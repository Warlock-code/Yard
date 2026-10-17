// Luck-game economy — wheel + mystery box payout tables and rolls.
// Kept separate from CREDIT_CONFIG so the mix logic is pure and testable.
//
// Paid wheel EV per 100cr spin:
//   72%   × avg(20,80)=50    → 36.00
//   21%   × avg(80,160)=120  → 25.20
//   5%    × avg(160,300)=230 → 11.50
//   1.5%  × avg(300,600)=450 → 6.75
//   0.5%  × 1000 jackpot     → 5.00
//   base EV = 84.45
//   + 5% rare bonus × avg(50,150)=100 → +5.00
//   total EV ≈ 89.45cr per 100cr spin (~10.5% house edge).
// 10x bundle costs 950cr (95cr/spin): EV ≈ 894.5 vs 950 → ~5.8% house edge.
// Important: the bundle MUST stay priced above 10× the per-spin EV — at the
// old 800cr price this table would have made the bundle +EV (a faucet).
//
// Mystery box EV per 100cr: base 85.5 (see route) + 8% × 100 = 93.5
// (~6.5% house edge). Credits-only, no cash value.
export const WHEEL_FREE_RANGE = [5, 50] as const
export const WHEEL_PAID_TIERS = [
  { chance: 0.72, range: [20, 80] },
  { chance: 0.21, range: [80, 160] },
  { chance: 0.05, range: [160, 300] },
  { chance: 0.015, range: [300, 600] },
  { chance: 0.005, range: [1000, 1000] },
] as const
export const WHEEL_PAID_RANGE = [20, 1000] as const
export const WHEEL_RARE_BONUS_CHANCE = 0.05
export const WHEEL_RARE_BONUS_RANGE = [50, 150] as const
export const BOX_RARE_BONUS_CHANCE = 0.08
export const BOX_RARE_BONUS_RANGE = [50, 150] as const

export function rollInt(range: readonly [number, number]): number {
  const [min, max] = range
  return min + Math.floor(Math.random() * (max - min + 1))
}

export function rollWheelPaid(): number {
  const r = Math.random()
  let cumulative = 0
  for (const tier of WHEEL_PAID_TIERS) {
    cumulative += tier.chance
    if (r < cumulative) return rollInt(tier.range)
  }
  return rollInt(WHEEL_PAID_TIERS[WHEEL_PAID_TIERS.length - 1].range)
}
