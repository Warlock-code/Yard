"use client"

import { useEffect } from "react"
import { useRouter } from "next/navigation"
import { prewarmAppData, setCached, cacheKeys, TTL } from "@/lib/client-cache"

const ROUTES_TO_PREFETCH = [
  "/feed",
  "/explore",
  "/battles",
  "/leaderboard",
  "/shop",
  "/notifications",
  "/lair",
  "/compose",
  "/search",
]

export function useRoutePrefetch() {
  const router = useRouter()

  useEffect(() => {
    if (typeof window === "undefined") return

    // Deferred past first paint: data warm + route JS must never contend
    // with the foreground page's critical fetch on cold boot.
    const warmTimer = window.setTimeout(() => {
      try {
        if (!document.hidden) prewarmAppData()
      } catch {}
    }, 3000)

    // Staggered, connection-aware route prefetch. Copies the list (the old
    // code mutated the module array with shift(), so only the first mount
    // ever prefetched). Skips entirely on save-data / 2G.
    const queue = [...ROUTES_TO_PREFETCH]
    let cancelled = false
    let timer: ReturnType<typeof setTimeout> | undefined

    const shouldPrefetch = () => {
      try {
        const conn = (navigator as unknown as { connection?: { saveData?: boolean; effectiveType?: string } }).connection
        if (conn?.saveData) return false
        if (conn?.effectiveType === "2g" || conn?.effectiveType === "slow-2g") return false
        if (document.hidden) return false
      } catch {}
      return true
    }

    const w = window as unknown as { requestIdleCallback?: (cb: () => void, opts?: { timeout: number }) => void }
    const pump = () => {
      if (cancelled) return
      if (!shouldPrefetch()) {
        // Retry later instead of burning radio on a hidden/slow client.
        timer = setTimeout(pump, 5000)
        return
      }
      try {
        // One route per idle slice — never bursts 9 navigations at once.
        const route = queue.shift()
        if (route) router.prefetch(route)
      } catch {}
      if (queue.length > 0) {
        timer = setTimeout(pump, 1500)
      }
    }

    const start = () => {
      if (cancelled) return
      // First prefetch waits for real idle + first paint, not boot.
      if (typeof w.requestIdleCallback === "function") {
        w.requestIdleCallback(pump, { timeout: 6000 })
      } else {
        timer = setTimeout(pump, 4000)
      }
    }
    start()

    return () => {
      cancelled = true
      clearTimeout(warmTimer)
      if (timer !== undefined) clearTimeout(timer)
    }
  }, [router])
}

export function prefetchDataFor(href: string) {
  if (typeof window === "undefined") return
  try {
    if (href === "/feed" || href.startsWith("/feed")) {
      fetch("/api/posts?mode=campus", { credentials: "include" })
        .then((r) => (r.ok ? r.json() : null))
        .then((d) => { if (d?.posts) setCached(cacheKeys.feed("campus"), d, TTL.feed) })
        .catch(() => {})
    } else if (href === "/battles") {
      fetch("/api/battles", { credentials: "include" })
        .then((r) => (r.ok ? r.json() : null))
        .then((d) => { if (d) setCached(cacheKeys.battles, d, TTL.misc) })
        .catch(() => {})
    } else if (href === "/leaderboard") {
      fetch("/api/leaderboard", { credentials: "include" })
        .then((r) => (r.ok ? r.json() : null))
        .then((d) => { if (d) setCached(cacheKeys.leaderboard, d, TTL.misc) })
        .catch(() => {})
    }
  } catch {}
}

export function prefetchOnHover(href: string) {
  prefetchDataFor(href);
  if (typeof window !== "undefined") {
    const link = document.createElement("link")
    link.rel = "prefetch"
    link.href = href
    document.head.appendChild(link)
  }
}

export function useHoverPrefetch() {
  useEffect(() => {
    const handleMouseEnter = (e: MouseEvent) => {
      const target = e.target as Node
      if (!(target instanceof Element)) return
      const link = target.closest("a[href]") as HTMLAnchorElement | null
      if (link) {
        const href = link.getAttribute("href")
        if (href && href.startsWith("/")) {
          prefetchOnHover(href)
        }
      }
    }

    document.addEventListener("mouseenter", handleMouseEnter, true)
    return () => document.removeEventListener("mouseenter", handleMouseEnter, true)
  }, [])
}