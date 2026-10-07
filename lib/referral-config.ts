export const REFERRAL_CONFIG = {
  REFERRER_REWARD: 500,
  REFEREE_REWARD: 250,
  DAILY_CAP: 10,
  VELOCITY_THRESHOLD: 20,
} as const

export type ReferralConfig = typeof REFERRAL_CONFIG