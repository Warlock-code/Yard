import type {
  FeedResponse,
  MeResponse,
  CommentResponse,
  VoteResponse,
  FollowResponse,
  BoostResponse,
  ReportResponse,
  SearchResponse,
  TrendingResponse,
  StatsResponse,
  MetricsResponse,
  AdminUser,
  AdminPost,
  Report,
  Payout,
  BattlePrompt,
  BattleEntry,
  LeaderboardEntry,
} from "@/lib/api-types"

type ApiResponse<T> = T extends { error: string } ? T : T

export async function apiPost<T = unknown>(url: string, body: unknown): Promise<ApiResponse<T>> {
  const res = await fetch(url, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
    credentials: "include",
  })

  const text = await res.text()
  let data: unknown = {}
  try {
    data = text ? JSON.parse(text) : {}
  } catch {
    throw new Error(text?.slice(0, 200) || `Request failed (${res.status})`)
  }

  if (!res.ok) {
    const err = data as { error?: string; message?: string }
    throw new Error(err?.error || err?.message || `Something went wrong (${res.status}). Please try again.`)
  }
  return data as ApiResponse<T>
}

export async function apiGet<T = unknown>(url: string): Promise<ApiResponse<T>> {
  const res = await fetch(url, { credentials: "include" })

  const text = await res.text()
  let data: unknown = {}
  try {
    data = text ? JSON.parse(text) : {}
  } catch {
    throw new Error(text?.slice(0, 200) || `Request failed (${res.status})`)
  }

  if (!res.ok) {
    const err = data as { error?: string; message?: string }
    throw new Error(err?.error || err?.message || `Something went wrong (${res.status}).`)
  }
  return data as ApiResponse<T>
}

export async function apiDelete<T = unknown>(url: string): Promise<ApiResponse<T>> {
  const res = await fetch(url, { method: "DELETE", credentials: "include" })
  const text = await res.text()
  let data: unknown = {}
  try {
    data = text ? JSON.parse(text) : {}
  } catch {
    throw new Error(text?.slice(0, 200) || `Request failed (${res.status})`)
  }
  if (!res.ok) {
    const err = data as { error?: string; message?: string }
    throw new Error(err?.error || err?.message || `Something went wrong (${res.status}).`)
  }
  return data as ApiResponse<T>
}

export async function apiPatch<T = unknown>(url: string, body: unknown): Promise<ApiResponse<T>> {
  const res = await fetch(url, {
    method: "PATCH",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
    credentials: "include",
  })
  const text = await res.text()
  let data: unknown = {}
  try {
    data = text ? JSON.parse(text) : {}
  } catch {
    throw new Error(text?.slice(0, 200) || `Request failed (${res.status})`)
  }
  if (!res.ok) {
    const err = data as { error?: string; message?: string }
    throw new Error(err?.error || err?.message || `Something went wrong (${res.status}).`)
  }
  return data as ApiResponse<T>
}

export const api = {
  getMe: () => apiGet<MeResponse>("/api/auth/me"),
  getFeed: (mode: string, seed?: string, cursor?: string) => {
    const params = new URLSearchParams({ mode })
    if (seed) params.set("seed", seed)
    if (cursor) params.set("cursor", cursor)
    return apiGet<FeedResponse>(`/api/posts?${params}`)
  },
  createPost: (data: { text: string; imageUrl?: string; type?: string; visibility?: "school" | "program" }) =>
    apiPost<{ post: FeedResponse["posts"][0] }>("/api/posts", data),
  votePost: (postId: string) => apiPost<VoteResponse>(`/api/posts/${postId}/vote`, {}),
  getComments: (postId: string, sort?: "top" | "latest") =>
    apiGet<CommentResponse>(`/api/posts/${postId}/comments${sort ? `?sort=${sort}` : ""}`),
  addComment: (postId: string, text: string, parentId?: string) =>
    apiPost<{ comment: CommentResponse["comments"][0] }>(`/api/posts/${postId}/comments`, { text, parentId }),
  followUser: (targetUserId: string) => apiPost<FollowResponse>("/api/follow", { targetUserId }),
  boostPost: (postId: string) => apiPost<BoostResponse>(`/api/boost/${postId}`, {}),
  reportPost: (postId: string, reason: string) => apiPost<ReportResponse>("/api/reports", { postId, reason }),
  deletePost: (postId: string) => apiDelete(`/api/posts/${postId}`),
  editPost: (postId: string, text: string) => apiPatch(`/api/posts/${postId}`, { text }),
  getStorage: () => apiGet<{ storageUsed: number; storageRemaining: number; storageLimit: number }>("/api/storage"),
  getTrending: (type: "hashtags" | "posts", limit?: number) =>
    apiGet<TrendingResponse>(`/api/trending?type=${type}${limit ? `&limit=${limit}` : ""}`),
  getSearch: (query: string, filters?: Record<string, string>) => {
    const params = new URLSearchParams({ q: query })
    if (filters) Object.entries(filters).forEach(([k, v]) => params.set(k, v))
    return apiGet<SearchResponse>(`/api/search?${params}`)
  },
  getLeaderboard: () => apiGet<{ leaderboard: LeaderboardEntry[] }>("/api/leaderboard"),
  getBattles: (campus?: string) => {
    const params = campus ? new URLSearchParams({ campus }) : undefined
    return apiGet<{ prompts: BattlePrompt[] }>(`/api/battles${params ? `?${params}` : ""}`)
  },
  enterBattle: (promptId: string, data: { text?: string; imageUrl?: string; voiceUrl?: string }) =>
    apiPost<{ entry: BattleEntry }>(`/api/battles/enter`, { promptId, ...data }),
  voteBattle: (entryId: string) => apiPost<{ votes: number }>(`/api/battles/vote`, { entryId }),
  getNotifications: () => apiGet<{ notifications: { id: string; type: string; title: string; body: string; href: string; readAt: string | null; createdAt: string }[] }>("/api/notifications"),
  markNotificationRead: (notificationId: string) => apiPatch(`/api/notifications/${notificationId}/read`, {}),
  getAdminStats: () => apiGet<StatsResponse>("/api/admin/stats"),
  getAdminMetrics: (range: 7 | 30) => apiGet<MetricsResponse>(`/api/admin/metrics?range=${range}`),
  getAdminReports: () => apiGet<{ reports: Report[] }>("/api/admin/reports"),
  actionReport: (reportId: string, decision: "actioned" | "dismissed") =>
    apiPost(`/api/admin/reports/${reportId}/action`, { decision }),
  getAdminPayouts: (status?: "pending" | "paid" | "all") =>
    apiGet<{ payouts: Payout[] }>(`/api/admin/payouts${status ? `?status=${status}` : ""}`),
  approvePayout: (payoutId: string) => apiPost(`/api/admin/payouts/${payoutId}/approve`, {}),
  getAdminUsers: (search?: string, tier?: string) => {
    const params = new URLSearchParams()
    if (search) params.set("search", search)
    if (tier && tier !== "ALL") params.set("tier", tier)
    return apiGet<{ users: AdminUser[] }>(`/api/admin/users?${params}`)
  },
  updateAdminUser: (userId: string, action: "suspend" | "ban" | "delete") =>
    apiPatch(`/api/admin/users/${userId}`, { action }),
  getAdminPosts: (search?: string) => {
    const params = search ? new URLSearchParams({ search }) : undefined
    return apiGet<{ posts: AdminPost[] }>(`/api/admin/posts${params ? `?${params}` : ""}`)
  },
  deleteAdminPost: (postId: string) => apiDelete(`/api/admin/posts/${postId}`),
  createBattle: (data: { text: string; campus: string; durationHours: number }) =>
    apiPost<{ prompt: BattlePrompt }>("/api/admin/battles/create", data),
  getProfile: (ghostId: string) => apiGet<{ user: MeResponse["user"]; posts: FeedResponse["posts"] }>(`/api/users/${ghostId}`),
  updateAvatar: (emoji: string) => apiPost<{ avatarEmoji: string }>("/api/profile/avatar", { emoji }),
  changeGhostName: (newName: string) => apiPost<{ authorization_url: string }>("/api/shop/custom-name", { newName }),
  buyBoostCredits: (packId: string) => apiPost<{ authorization_url: string }>("/api/shop/boost-credit", { packId }),
  buyStreakFreeze: () => apiPost<{ authorization_url: string }>("/api/shop/streak-freeze", {}),
  buyStreakRestore: () => apiPost<{ authorization_url: string }>("/api/shop/streak-restore", {}),
  buyStorage: (mb: number) => apiPost<{ authorization_url: string }>("/api/shop/storage", { mb }),
  buyCosmetic: (cosmeticId: string) => apiPost<{ authorization_url: string }>("/api/shop/cosmetic", { cosmeticId }),
  getCreditsBalance: () => apiGet<{ balance: number }>("/api/credits/balance"),
  purchaseCredits: (packId: string) => apiPost<{ authorization_url: string }>("/api/credits/purchase", { packId }),
  withdrawCredits: (amount: number, bankCode: string, accountNumber: string, accountName: string) =>
    apiPost<{ providerRef: string }>("/api/credits/withdraw", { amount, bankCode, accountNumber, accountName }),
  getCreditTransactions: () => apiGet<{ transactions: { id: string; type: string; amount: number; balanceAfter: number; createdAt: string }[] }>("/api/credits/transactions"),
  requestPayout: (amount: number, bankCode: string, accountNumber: string, accountName: string) =>
    apiPost<{ id: string }>("/api/payout/request", { amount, bankCode, accountNumber, accountName }),
  getPayouts: () => apiGet<{ payouts: Payout[] }>("/api/payouts/list"),
}