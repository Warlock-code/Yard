"use client"

import Link from "next/link"
import { usePathname } from "next/navigation"
import { useEffect, useState } from "react"
import { apiGet } from "@/lib/useApi"
import type { MeResponse } from "@/lib/api-types"
import Avatar from "@/app/components/Avatar"
import { useHoverPrefetch } from "@/lib/prefetch"
import { prefetchDataFor } from "@/lib/prefetch"
import { getCached, setCached, cacheKeys, TTL } from "@/lib/client-cache"

const TABS = [
  { href: "/feed", icon: "🏠", label: "feed" },
  { href: "/lair", icon: "👻", label: "lair", alsoActiveOn: ["/lair/activity"] },
  { href: "/battles", icon: "⚔️", label: "battles" },
  { href: "/leaderboard", icon: "🏆", label: "boards" },
  { href: "/shop", icon: "🛍️", label: "market" },
  { href: "/notifications", icon: "🔔", label: "notifications" },
]

export default function BottomNav() {
  const pathname = usePathname()
  const [unreadCount, setUnreadCount] = useState(0)
  const [authenticatedPath, setAuthenticatedPath] = useState<string | null>(null)
  const [avatarEmoji, setAvatarEmoji] = useState("👻")
  const hideOn = ["/", "/login", "/signup", "/verify-email", "/compose", "/upgrade", "/admin", "/download"]
  const hidePrefixes = ["/post/", "/admin/", "/u/", "/payment/"]

  useHoverPrefetch()

  useEffect(() => {
    let active = true
    // Instant badge from cache
    const cachedCount = getCached<{ unreadCount: number }>(cacheKeys.notificationsCount)
    if (cachedCount && typeof cachedCount.unreadCount === "number") setUnreadCount(cachedCount.unreadCount)

    async function loadUnreadCount() {
      try {
        const data = await apiGet<{ unreadCount: number }>("/api/notifications?limit=1")
        if (active) {
          setUnreadCount(data.unreadCount || 0)
          setCached(cacheKeys.notificationsCount, data, TTL.misc)
        }
      } catch {
        if (active) setUnreadCount(0)
      }
    }

    async function refresh() {
      try {
        const data = await apiGet<MeResponse>("/api/auth/me")
        if (!active) return
        setAuthenticatedPath(data.user ? pathname : null)
        if (!data.user) {
          setAvatarEmoji("👻")
          setUnreadCount(0)
          return
        }
        setAvatarEmoji(data.user.avatarEmoji)
      } catch {
        if (active) {
          setAuthenticatedPath(null)
          setUnreadCount(0)
        }
        return
      }

      await loadUnreadCount()
    }

    refresh()
    const interval = window.setInterval(refresh, 20_000)
    return () => {
      active = false
      window.clearInterval(interval)
    }
  }, [pathname])

  if (
    authenticatedPath !== pathname ||
    hideOn.includes(pathname) ||
    hidePrefixes.some((p) => pathname.startsWith(p))
  )
    return null

  return (
    <nav
      aria-label="primary"
      className="fixed bottom-[calc(0.75rem+env(safe-area-inset-bottom,0px))] left-0 right-0 z-20 flex justify-center px-4"
    >
      <div className="flex gap-0.5 bg-[#0a0a0a]/20 backdrop-blur-sm border border-white/10 rounded-full px-1.5 py-1.5 shadow-[0_8px_30px_rgba(0,0,0,0.2)]">
        {TABS.map((tab) => {
          const active =
            pathname === tab.href ||
            pathname.startsWith(tab.href + "/") ||
            ("alsoActiveOn" in tab &&
              Array.isArray((tab as { alsoActiveOn?: string[] }).alsoActiveOn) &&
              (tab as { alsoActiveOn?: string[] }).alsoActiveOn!.some(
                (p) => pathname === p || pathname.startsWith(p + "/")
              ))
          return (
            <Link
              key={tab.href}
              href={tab.href}
              aria-label={tab.label}
              aria-current={active ? "page" : undefined}
              prefetch={true}
              onMouseEnter={() => prefetchDataFor(tab.href)}
              onTouchStart={() => prefetchDataFor(tab.href)}
              className={`relative flex h-9 items-center justify-center gap-1 rounded-full text-base transition-all ${
                active
                  ? "bg-primary/15 text-primary px-3"
                  : "w-9 text-white/40 hover:text-white/70"
              }`}
            >
              {tab.href === "/lair" ? (
                <Avatar emoji={avatarEmoji} size={24} />
              ) : (
                <span aria-hidden="true" className="text-xl">{tab.icon}</span>
              )}
              {active && <span className="text-[11px] font-bold tracking-tight">{tab.label}</span>}
              {tab.href === "/feed" && unreadCount > 0 && (
                <span
                  aria-label={`${unreadCount} unread haunts`}
                  role="status"
                  className="absolute top-0.5 right-0.5 w-2 h-2 rounded-full bg-[#ff4d6d] border-2 border-[#0a0a0a]"
                />
              )}
            </Link>
          )
        })}
      </div>
    </nav>
  )
}
