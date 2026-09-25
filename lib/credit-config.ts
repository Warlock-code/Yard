export const CREDIT_CONFIG = {
  CREDITS_PER_GHS: 100,
  MIN_WITHDRAWAL_CREDITS: 2_000,
  MIN_WITHDRAWAL_GHS: 20,

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
    BATTLE_WIN_BRACKET_ROUND: 200,
    BATTLE_WIN_FINAL: 2_000,
    LEADERBOARD_WEEKLY_1: 5_000,
    LEADERBOARD_WEEKLY_2: 2_500,
    LEADERBOARD_WEEKLY_3: 1_250,
    LEADERBOARD_MONTHLY_1: 20_000,
    LEADERBOARD_MONTHLY_2: 10_000,
    LEADERBOARD_MONTHLY_3: 5_000,
    REFERRAL_REFERRER: 500,
    REFERRAL_REFEREE: 250,
    STREAK_7D: 100,
    STREAK_30D: 500,
  },

  SPEND: {
    BOOST_24H: 300,
    BOOST_7D: 1_500,
    CUSTOM_NAME: 300,
    AVATAR_PACK: 500,
    THEME: 400,
    STORAGE_100MB: 200,
    STREAK_FREEZE_7D: 200,
    STREAK_RESTORE: 500,
    BATTLE_ENTRY_PREMIUM: 200,
    TIP_MIN: 50,
    TIP_MAX_DAILY: 2_000,
    TIP_MAX_PER_USER_DAILY: 500,
  },

  FEE: {
    WITHDRAWAL_PCT: 20,
    TIP_PCT: 10,
    PAYSTACK_DEPOSIT_PCT: 2.5,
    PAYSTACK_PAYOUT_FLAT: 1.5,
  },

  LIMITS: {
    MIN_ACCOUNT_AGE_DAYS: 14,
    MIN_EARNED_CREDITS_TO_WITHDRAW: 1_000,
    KYC_REQUIRED: true,
    MAX_DAILY_WITHDRAWAL_GHS: 5_000,
  },

  TIER_MULTIPLIER: {
    FREE: { earn: 1.0, tipReceived: 0.9, battle: 1.0, withdrawalFee: 25 },
    PLUS: { earn: 1.25, tipReceived: 1.0, battle: 1.25, withdrawalFee: 20 },
    PRIME: { earn: 1.5, tipReceived: 1.1, battle: 1.5, withdrawalFee: 15 },
  },
} as const

export type CreditConfig = typeof CREDIT_CONFIG
export type CreditPack = typeof CREDIT_CONFIG.PACKS[number]
export type EarnType = keyof typeof CREDIT_CONFIG.EARN
export type SpendType = keyof typeof CREDIT_CONFIG.SPEND