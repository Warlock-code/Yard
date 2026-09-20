"use client"

import { createContext, useContext, useEffect, useState, ReactNode } from "react"
import { apiGet } from "@/lib/useApi"
import { getEffectiveTier } from "@/lib/tier"

type Tier = "FREE" | "PLUS" | "PRIME"

interface ThemeContextType {
  tier: Tier
  isLoading: boolean
}

const ThemeContext = createContext<ThemeContextType>({ tier: "FREE", isLoading: true })

export function ThemeProvider({ children }: { children: ReactNode }) {
  const [tier, setTier] = useState<Tier>("FREE")
  const [isLoading, setIsLoading] = useState(true)

  useEffect(() => {
    let active = true

    async function loadTier() {
      try {
        const data = await apiGet("/api/auth/me")
        if (active && data.user) {
          const effectiveTier = getEffectiveTier({
            tier: data.user.tier,
            tierExpiresAt: data.user.tierExpiresAt ? new Date(data.user.tierExpiresAt) : null,
          })
          setTier(effectiveTier)
        }
      } catch {
        if (active) setTier("FREE")
      } finally {
        if (active) setIsLoading(false)
      }
    }

    loadTier()
    const interval = setInterval(loadTier, 30_000)
    return () => {
      active = false
      clearInterval(interval)
    }
  }, [])

  useEffect(() => {
    if (isLoading) return
    const root = document.documentElement
    root.classList.remove("tier-free", "tier-plus", "tier-prime")
    root.classList.add(`tier-${tier.toLowerCase()}`)
  }, [tier, isLoading])

  return (
    <ThemeContext.Provider value={{ tier, isLoading }}>
      {children}
    </ThemeContext.Provider>
  )
}

export function useTierTheme() {
  const context = useContext(ThemeContext)
  if (!context) throw new Error("useTierTheme must be used within ThemeProvider")
  return context
}