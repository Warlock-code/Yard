"use client"

import Link from "next/link"
import { usePathname } from "next/navigation"
import { useEffect, useState } from "react"
import { apiGet } from "@/lib/useApi"

const TABS = [
  { href: "/feed", icon: "🏠" },
  { href: "/notifications", icon: "🔔" },
  { href: "/battles", icon: "⚔️" },
  { href: "/leaderboard", icon: "🏆" },
  { href: "/shop", icon: "🛍️" },
  { href: "/lair", icon: "👻" },
]

export default function BottomNav() {
  const pathname = usePathname()
  const [unreadCount, setUnreadCount] = useState(0)
  const [authenticatedPath, setAuthenticatedPath] = useState<string | null>(null)
  const hideOn = ["/", "/login", "/signup", "/verify-email", "/compose"]
  const hidePrefixes = ["/post/"]

  useEffect(() => {
    let active = true

    async function loadUnreadCount() {
      try {
        const data = await apiGet("/api/notifications?limit=1")
        if (active) setUnreadCount(data.unreadCount || 0)
      } catch {
        if (active) setUnreadCount(0)
      }
    }

    async function refresh() {
      try {
        const data = await apiGet("/api/auth/me")
        if (!active) return
        setAuthenticatedPath(data.user ? pathname : null)
        if (!data.user) {
          setUnreadCount(0)
          return
        }
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
  ) return null

  return (
    <nav className="fixed bottom-5 left-0 right-0 z-20 flex justify-center px-6">
      <div className="flex gap-1 bg-[#0a0a0a]/35 backdrop-blur-md border border-white/10 rounded-full px-2 py-2 shadow-[0_8px_30px_rgba(0,0,0,0.35)]">
        {TABS.map((tab) => {
          const active = pathname === tab.href || pathname.startsWith(tab.href + "/")
          return (
            <Link
              key={tab.href}
              href={tab.href}
              className={`relative w-11 h-11 flex items-center justify-center rounded-full text-lg transition-all ${
                active ? "bg-[#baff39]/15 text-[#baff39]" : "text-white/40"
              }`}
            >
              {tab.icon}
              {tab.href === "/notifications" && unreadCount > 0 && (
                <span
                  aria-label={`${unreadCount} unread notifications`}
                  className="absolute top-1 right-1 w-2.5 h-2.5 rounded-full bg-[#ff4d6d] border-2 border-[#0a0a0a]"
                />
              )}
            </Link>
          )
        })}
      </div>
    </nav>
  )
}