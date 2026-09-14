"use client"

import Link from "next/link"
import { usePathname } from "next/navigation"

const TABS = [
  { href: "/feed", icon: "🏠" },
  { href: "/battles", icon: "⚔️" },
  { href: "/leaderboard", icon: "🏆" },
  { href: "/shop", icon: "🛍️" },
  { href: "/lair", icon: "👻" },
]

export default function BottomNav() {
  const pathname = usePathname()
  const hideOn = ["/", "/login", "/signup", "/verify-email"]
  if (hideOn.includes(pathname)) return null

  return (
    <nav className="fixed bottom-5 left-0 right-0 z-20 flex justify-center px-6">
      <div className="flex gap-1 bg-[#111]/95 backdrop-blur border border-white/10 rounded-full px-2 py-2 shadow-[0_8px_30px_rgba(0,0,0,0.5)]">
        {TABS.map((tab) => {
          const active = pathname === tab.href || pathname.startsWith(tab.href + "/")
          return (
            <Link
              key={tab.href}
              href={tab.href}
              className={`w-11 h-11 flex items-center justify-center rounded-full text-lg transition-all ${
                active ? "bg-[#baff39]/15 text-[#baff39]" : "text-white/40"
              }`}
            >
              {tab.icon}
            </Link>
          )
        })}
      </div>
    </nav>
  )
}