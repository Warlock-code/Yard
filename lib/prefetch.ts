"use client"

import { useEffect } from "react"
import { useRouter } from "next/navigation"

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

    const idleCallback = (deadline: IdleDeadline) => {
      while (deadline.timeRemaining() > 0 && ROUTES_TO_PREFETCH.length > 0) {
        const route = ROUTES_TO_PREFETCH.shift()
        if (route) {
          router.prefetch(route)
        }
      }
      if (ROUTES_TO_PREFETCH.length > 0) {
        requestIdleCallback(idleCallback)
      }
    }

    if ("requestIdleCallback" in window) {
      requestIdleCallback(idleCallback)
    } else {
      setTimeout(() => {
        ROUTES_TO_PREFETCH.forEach((route) => router.prefetch(route))
      }, 1000)
    }
  }, [router])
}

export function prefetchOnHover(href: string) {
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
      const target = e.target as HTMLElement
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