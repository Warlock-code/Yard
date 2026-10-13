export const CREDIT_CONFIG = {
  // Credits are a virtual in-app currency for entertainment only.
  // They have no monetary value and are never redeemable for cash.
  // CREDITS_PER_GHS is an earn-side display conversion only (e.g. milestone
  // bonus sizing) — not a cash-out rate. No withdrawal path exists.
  CREDITS_PER_GHS: 100,

  PACKS: [
    { id: "starter", name: "Starter", ghs: 5, credits: 500, bonusPct: 0, description: "Test the waters", isActive: true, sortOrder: 1 },
    { id: "student", name: "Student", ghs: 10, credits: 1_100, bonusPct: 10, description: "Most popular", isActive: true, sortOrder: 2 },
    { id: "popular", name: "Popular", ghs: 20, credits: 2_400, bonusPct: 20, description: "Best value", isActive: true, sortOrder: 3 },
    { id: "baller", name: "Baller", ghs: 50, credits: 6_500, bonusPct: 30, description: "For heavy tippers", isActive: true, sortOrder: 4 },
    { id: "whale", name: "Whale", ghs: 100, credits: 14_000, bonusPct: 40, description: "Max power", isActive: true, sortOrder: 5 },
  ] as const,

  EARN: {
    POST_VOTE: 1,
    COMMENT_VOTE: 1,
    BATTLE_WIN_SINGLE: 500,
    BATTLE_WIN_BRACKET_ROUND: 500,
    BATTLE_WIN_FINAL: 500,
    LEADERBOARD_WEEKLY_1: 2_000,
    LEADERBOARD_WEEKLY_2: 1_000,
    LEADERBOARD_WEEKLY_3: 500,
    LEADERBOARD_MONTHLY_1: 2_000,
    LEADERBOARD_MONTHLY_2: 1_000,
    LEADERBOARD_MONTHLY_3: 500,
    REFERRAL_REFERRER: 1_000,
    REFERRAL_REFEREE: 500,
    STREAK_7D: 100,
    STREAK_30D: 500,
    COTD_WIN: 500,
    TIP_LEADER_WEEKLY: 500,
    WINBACK_7D: 100,
    WINBACK_30D: 500,
  },

  SPEND: {
    BOOST_24H: 300,
    BOOST_3D: 700,
    BOOST_7D: 1_500,
    BOOST_ALLCAMPUS: 2_000,
    BOOST_MEGA: 5_000,
    PIN_1H: 1_000,
    CUSTOM_NAME: 500,
    AVATAR_PACK: 500,
    THEME: 400,
    STORAGE_100MB: 200,
    STREAK_FREEZE_48H: 200,
    STREAK_RESTORE: 500,
    STREAK_MULT_2X: 500,
    STREAK_MULT_3X: 1_200,
    BATTLE_ENTRY_PREMIUM: 200,
    DUEL_ENTRY: 500,
    VOICE_POST: 100,
    VOICE_BOOST: 500,
    POLL_CREATE: 100,
    REPLY_EXTRA: 20,
    REPLY_BOOST: 100,
    ANON_MENTION: 50,
    NAME_REVEAL: 200,
    NAME_REVEAL_WEEK: 1_000,
    PROFILE_BANNER: 500,
    PROFILE_COLOR_NAME: 400,
    PROFILE_FRAME: 800,
    PROFILE_BUNDLE: 2_000,
    REACTION_UNLOCK: 50,
    REACTION_USE: 10,
    WHEEL_SPIN: 100,
    WHEEL_BUNDLE_10: 800,
    MYSTERY_BOX: 100,
    CAMPUS_WAR_SMALL: 100,
    CAMPUS_WAR_MED: 1_000,
    CAMPUS_WAR_LARGE: 5_000,
    XCAMPUS_POST: 500,
    ALLCAMPUS_POST: 2_000,
    REFERRAL_BOOST: 200,
    SCHED_PACK_10: 300,
    TIP_MIN: 50,
    TIP_MAX_DAILY: 2_000,
    TIP_MAX_PER_USER_DAILY: 500,
  },

  BATTLE: {
    ENTRY_FEE: 200,
    RAKE_PCT: 20,
    WINNER_PCT: 80,
    PRIME_FREE_ENTRIES_PER_DAY: 1,
    DUEL_ENTRY: 500,
  },

  FEE: {
    TIP_PCT: 10,
    PAYSTACK_DEPOSIT_PCT: 2.5,
    PAYSTACK_PAYOUT_FLAT: 1.5,
  },

  TIER_MULTIPLIER: {
    FREE: { earn: 0, tipReceived: 0, battle: 0 },
    PLUS: { earn: 1.0, tipReceived: 1.0, battle: 2.0 },
    PRIME: { earn: 2.0, tipReceived: 2.0, battle: 2.0 },
  },
} as const

// --- Limited-time drops (Workstream E, task 4) ---
// Weekly 48h FOMO drop: one avatar/theme at base price, 2x after expiry.
// Shop route TODO: consume getWeeklyDrop(), show `isLimited` + `endsAt`
// countdown, charge priceCredits while live else afterPriceCredits.
export const DROP_CONFIG = {
  DURATION_HOURS: 48,
  PRICE_MULT_AFTER: 2,
  ROTATION: [
    { kind: "avatar", id: "avatar_dragon", name: "Dragon", priceCredits: 850 },
    { kind: "theme", id: "theme_rainbow", name: "Rainbow", priceCredits: 1500 },
    { kind: "avatar", id: "avatar_vampire", name: "Vampire", priceCredits: 750 },
    { kind: "theme", id: "theme_midnight", name: "Midnight", priceCredits: 1000 },
    { kind: "avatar", id: "avatar_ufo", name: "UFO", priceCredits: 1300 },
    { kind: "theme", id: "theme_purple", name: "Purple Haze", priceCredits: 700 },
  ],
} as const

export type WeeklyDrop = {
  id: string
  kind: "avatar" | "theme"
  cosmeticId: string
  name: string
  priceCredits: number
  afterPriceCredits: number
  startsAt: Date
  endsAt: Date
  isLimited: true
}

function weekMondayUTC(now: Date): Date {
  const day = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate()))
  const shift = (day.getUTCDay() + 6) % 7
  return new Date(day.getTime() - shift * 86_400_000)
}

/** Deterministic weekly drop: week of `now` picks one rotation entry. */
export function getWeeklyDrop(now: Date = new Date()): WeeklyDrop {
  const startsAt = weekMondayUTC(now)
  const weekIndex = Math.floor(startsAt.getTime() / (7 * 86_400_000))
  const entry = DROP_CONFIG.ROTATION[((weekIndex % DROP_CONFIG.ROTATION.length) + DROP_CONFIG.ROTATION.length) % DROP_CONFIG.ROTATION.length]
  const endsAt = new Date(startsAt.getTime() + DROP_CONFIG.DURATION_HOURS * 3_600_000)
  return {
    id: `drop-${startsAt.toISOString().slice(0, 10)}`,
    kind: entry.kind,
    cosmeticId: entry.kind === "theme" ? entry.id : entry.id,
    name: entry.name,
    priceCredits: entry.priceCredits,
    afterPriceCredits: entry.priceCredits * DROP_CONFIG.PRICE_MULT_AFTER,
    startsAt,
    endsAt,
    isLimited: true as const,
  }
}

export type CreditConfig = typeof CREDIT_CONFIG
export type CreditPack = typeof CREDIT_CONFIG.PACKS[number]
export type EarnType = keyof typeof CREDIT_CONFIG.EARN
export type SpendType = keyof typeof CREDIT_CONFIG.SPEND