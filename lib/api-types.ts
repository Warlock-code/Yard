export interface UserProfile {
  id: string
  email: string
  ghostId: string
  avatarEmoji: string
  campus: string
  program: string | null
  tier: "FREE" | "PLUS" | "PRIME"
  rawTier: "FREE" | "PLUS" | "PRIME"
  tierExpiresAt: string | null
  tierDaysLeft: number | null
  streakCount: number
  ghostCoins: number
  ownedCosmetics: string[]
  postCount: number
  followersCount: number
  followingCount: number
  totalEarnedPesewas: number
  availableBalancePesewas: number
  hasPendingPayout: boolean
  storageUsed: number
  storageLimit: number
  storageRemaining: number
  championTrophies: number
}

export interface Post {
  id: string
  userId: string
  text: string | null
  imageUrl: string | null
  imageUrls: string[] | null
  type: "confession" | "gossip" | "meme" | "voice"
  campus: string
  program: string | null
  programLevel: string | null
  programKey: string | null
  archived: boolean
  visibility: "school" | "program"
  yeahs: number
  commentsCount: number
  boosted: boolean
  boostedUntil: string | null
  isPrime: boolean
  createdAt: string
  user: {
    id: string
    ghostId: string
    avatarEmoji: string
    tier: "FREE" | "PLUS" | "PRIME"
    championTrophies?: number
  }
  isFollowing?: boolean
  seen?: boolean
}

export interface Comment {
  id: string
  postId: string
  userId: string
  ghostId: string
  text: string
  parentId: string | null
  yeahs: number
  createdAt: string
  user: {
    id: string
    ghostId: string
    avatarEmoji: string
    tier: "FREE" | "PLUS" | "PRIME"
    campus: string
    championTrophies?: number
  }
  votes: { id: string; userId: string }[]
  heated: boolean
  replies: Comment[]
}

export interface Notification {
  id: string
  userId: string
  type: string
  title: string
  body: string
  href: string
  actorName: string | null
  readAt: string | null
  createdAt: string
}

export interface FeedResponse {
  posts: Post[]
  nextCursor: string | null
}

export interface MeResponse {
  user: UserProfile | null
}

export interface CommentResponse {
  comments: Comment[]
  sort: "top" | "latest"
}

export interface VoteResponse {
  post: Post
}

export interface FollowResponse {
  following: boolean
}

export interface BoostResponse {
  success: boolean
  post?: Post
}

export interface ReportResponse {
  success: boolean
}

export interface SearchResponse {
  posts: Post[]
  users: { id: string; ghostId: string; avatarEmoji: string; campus: string }[]
  hashtags: { tag: string; postsCount: number }[]
}

export interface TrendingResponse {
  hashtags: { tag: string; postsCount: number }[]
}

export interface StatsResponse {
  userCount: number
  postCount: number
  primeCount: number
  plusCount: number
  activeUsers: number
  revenuePesewas: number
  pendingPayoutPesewas: number
  paidOutPesewas: number
}

export interface MetricsResponse {
  range: number
  dau: { day: string; count: number }[]
  postsPerDay: { day: string; count: number }[]
  postsPerUserByDay: { day: string; count: number }[]
  paywallHits: { day: string; count: number }[]
  funnel: { hits: number; checkoutStarted: number; paid: number }
  conversion: {
    userCount: number
    plusCount: number
    primeCount: number
    plusRate: number
    primeRate: number
    paidRate: number
  }
  payConversionByDay: { day: string; rate: number }[]
  retentionD1: { day: string; rate: number }[]
  retentionD7: { day: string; rate: number }[]
  arppuPesewas: number
  revenuePesewas: number
  paidOutPesewas: number
  payoutRatio: number
}

export interface AdminUser {
  id: string
  ghostId: string
  email: string
  campus: string
  tier: string
}

export interface AdminPost {
  id: string
  text: string | null
  user: { ghostId: string }
}

export interface Report {
  id: string
  reason: string
  aiVerdict: string | null
  post: { id: string; text: string | null } | null
  reporter: { ghostId: string }
}

export interface Payout {
  id: string
  amount: number
  status: string
  accountName: string | null
  accountNumber: string | null
  bankCode: string | null
  user: { ghostId: string; email: string }
}

export interface BattlePrompt {
  id: string
  text: string
  campus: string
  active: boolean
  type: "SINGLE" | "BRACKET" | "RECURRING"
  status: "UPCOMING" | "ACTIVE" | "VOTING" | "COMPLETED" | "CANCELLED"
  startsAt: string
  endsAt: string
  roundNumber: number
  totalRounds: number
  isPrimeOnly: boolean
  earlyAccessForPrime: boolean
  entryType: "TEXT" | "IMAGE" | "VOICE"
  entries?: BattleEntry[]
}

export interface BattleEntry {
  id: string
  promptId: string
  userId: string
  text: string | null
  imageUrl: string | null
  voiceUrl: string | null
  entryType: "TEXT" | "IMAGE" | "VOICE"
  campus: string
  votes: number
  isPrime: boolean
  roundNumber: number
  wonRound: boolean
  createdAt: string
  user: { ghostId: string; avatarEmoji: string; tier: string; championTrophies?: number }
}

export interface LeaderboardEntry {
  userId: string
  ghostId: string
  avatarEmoji: string
  campus: string
  tier: string
  yeahs: number
  postsCount: number
  rank: number
}