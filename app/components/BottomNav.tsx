"use client"

import Link from "next/link"
import { usePathname } from "next/navigation"

const TABS = [
  { href: "/feed", label: "Feed", icon: "🏠" },
  { href: "/battles", label: "Battles", icon: "⚔️" },
  { href: "/leaderboard", label: "Ranks", icon: "🏆" },
  { href: "/shop", label: "Shop", icon: "🛍️" },
  { href: "/lair", label: "Lair", icon: "👻" },
]

export default function BottomNav() {
  const pathname = usePathname()
  const hideOn = ["/", "/login", "/signup", "/verify-email"]
  if (hideOn.includes(pathname)) return null

  return (
    <nav className="fixed bottom-0 left-0 right-0 bg-black border-t border-white/10 z-20">
      <div className="max-w-lg mx-auto flex">
        {TABS.map((tab) => {
          const active = pathname === tab.href || pathname.startsWith(tab.href + "/")
          return (
            <Link
              key={tab.href}
              href={tab.href}
                          className={`flex-1 flex flex-col items-center py-2.5 text-xs transition-colors ${
                active ? "text-[#baff39]" : "text-white/40"
              }`}
            >
              <span className="text-lg">{tab.icon}</span>
              {tab.label}
            </Link>
          )
        })}
      </div>
    </nav>
  )
}