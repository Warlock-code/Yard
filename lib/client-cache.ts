"use client"

// Tiny stale-while-revalidate cache: memory + localStorage.
// Goal: instant page shells from cache, then silent background revalidate.
// No deps, safe for client components only.

type Entry<T = unknown> = { data: T; expiry: number }

const mem = new Map<string, Entry>()
const LS_PREFIX = "yard_cache:"

const TTL = {
  me: 60_000,
  feed: 30_000,
  misc: 60_000,
} as const

function lsGet<T>(key: string): T | null {
  try {
    const raw = localStorage.getItem(LS_PREFIX + key)
    if (!raw) return null
    const parsed = JSON.parse(raw) as Entry<T>
    if (!parsed || typeof parsed.expiry !== "number") return null
    if (parsed.expiry < Date.now()) {
      try { localStorage.removeItem(LS_PREFIX + key) } catch {}
      return null
    }
    return parsed.data
  } catch {
    return null
  }
}

function lsSet(key: string, data: unknown, ttlMs: number) {
  try {
    const entry: Entry = { data, expiry: Date.now() + ttlMs }
    localStorage.setItem(LS_PREFIX + key, JSON.stringify(entry))
  } catch {
    // quota / private mode — memory cache still works
  }
}

export function getCached<T>(key: string): T | null {
  const m = mem.get(key)
  if (m && m.expiry > Date.now()) return m.data as T
  if (m) mem.delete(key)
  if (typeof window === "undefined") return null
  return lsGet<T>(key)
}

export function setCached(key: string, data: unknown, ttlMs: number) {
  mem.set(key, { data, expiry: Date.now() + ttlMs })
  if (typeof window !== "undefined") lsSet(key, data, ttlMs)
}

export const cacheKeys = {
  me: "me",
  feed: (mode: string) => `feed:${mode}`,
  battles: "battles",
  leaderboard: "leaderboard",
  notificationsCount: "notif_count",
}

export async function fetchWithCache<T>(
  key: string,
  fetcher: () => Promise<T>,
  ttlMs: number,
  onUpdate?: (data: T) => void
): Promise<T | null> {
  const cached = getCached<T>(key)
  // Revalidate in background without blocking caller when cache hits
  const refresh = fetcher()
    .then((fresh) => {
      setCached(key, fresh, ttlMs)
      onUpdate?.(fresh)
      return fresh
    })
    .catch(() => cached)
  if (cached !== null) return cached
  try {
    return await refresh
  } catch {
    return null
  }
}

// Fire-and-forget warm of the 3 screens users open first.
// Called after login/signup and on idle in RoutePrefetcher.
let warming = false
export function prewarmAppData() {
  if (typeof window === "undefined" || warming) return
  warming = true
  const run = async () => {
    try {
      const meRes = await fetch("/api/auth/me", { credentials: "include" }).then((r) => (r.ok ? r.json() : null)).catch(() => null)
      if (meRes?.user) setCached(cacheKeys.me, meRes, TTL.me)
      // Warm campus feed + lightweight counts in parallel; never throws
      await Promise.allSettled([
        fetch("/api/posts?mode=campus", { credentials: "include" })
          .then((r) => (r.ok ? r.json() : null))
          .then((d) => { if (d?.posts) setCached(cacheKeys.feed("campus"), d, TTL.feed) }),
        fetch("/api/notifications?limit=1", { credentials: "include" })
          .then((r) => (r.ok ? r.json() : null))
          .then((d) => { if (d) setCached(cacheKeys.notificationsCount, d, TTL.misc) }),
      ])
    } finally {
      warming = false
    }
  }
  if ("requestIdleCallback" in window) {
    ;(window as unknown as { requestIdleCallback: (cb: () => void) => void }).requestIdleCallback(run)
  } else {
    setTimeout(run, 800)
  }
}

export { TTL }
