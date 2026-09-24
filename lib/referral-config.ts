export const REFERRAL_CONFIG = {
  REFERRER_REWARD: 50,
  REFEREE_REWARD: 25,
  DAILY_CAP: 10,
  VELOCITY_THRESHOLD: 20,
} as const

export type ReferralConfig = typeof REFERRAL_CONFIG