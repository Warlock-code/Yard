"use client"

import { createContext, useCallback, useContext, useEffect, useState, type ReactNode } from "react"
import { apiGet } from "@/lib/useApi"
import { getEffectiveTier } from "@/lib/tier"

type Tier = "FREE" | "PLUS" | "PRIME"

export type YardThemeChoice = "default" | "blue" | "gold"

export const YARD_THEME_STORAGE_KEY = "yard-theme"
export const YARD_THEME_EVENT = "yard-theme-change"

function readStoredTheme(): YardThemeChoice | null {
  if (typeof window === "undefined") return null
  try {
    const v = window.localStorage.getItem(YARD_THEME_STORAGE_KEY)
    if (v === "default" || v === "blue" || v === "gold") return v
    return null
  } catch {
    return null
  }
}

function resolveTierClass(tier: Tier, stored: YardThemeChoice | null): "tier-free" | "tier-plus" | "tier-prime" {
  if (tier === "FREE") return "tier-free"
  if (tier === "PLUS") return stored === "blue" ? "tier-plus" : "tier-free"
  // PRIME includes all PLUS perks: may opt into blue/green, otherwise keep gold.
  if (stored === "blue") return "tier-plus"
  if (stored === "default") return "tier-free"
  return "tier-prime"
}

function applyTierClass(cls: "tier-free" | "tier-plus" | "tier-prime") {
  const root = document.documentElement
  root.classList.remove("tier-free", "tier-plus", "tier-prime")
  root.classList.add(cls)
}

interface ThemeContextType {
  tier: Tier
  isLoading: boolean
  /** User's stored theme pick. `null` = unset (default). */
  themeChoice: YardThemeChoice | null
  setThemeChoice: (choice: YardThemeChoice) => void
}

const ThemeContext = createContext<ThemeContextType>({
  tier: "FREE",
  isLoading: true,
  themeChoice: null,
  setThemeChoice: () => {},
})

export function ThemeProvider({ children }: { children: ReactNode }) {
  const [tier, setTier] = useState<Tier>("FREE")
  const [isLoading, setIsLoading] = useState(true)
  const [themeChoice, setThemeChoiceState] = useState<YardThemeChoice | null>(null)

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

  // Init from localStorage + stay in sync (other tabs + in-app custom events from Shop).
  useEffect(() => {
    setThemeChoiceState(readStoredTheme())

    const onStorage = (e: StorageEvent) => {
      if (e.key !== YARD_THEME_STORAGE_KEY) return
      const v = e.newValue
      if (v === "default" || v === "blue" || v === "gold") setThemeChoiceState(v)
      else if (v === null) setThemeChoiceState(null)
    }

    const onCustomTheme = (e: Event) => {
      const detail = (e as CustomEvent<YardThemeChoice>).detail
      if (detail === "default" || detail === "blue" || detail === "gold") {
        setThemeChoiceState(detail)
        try {
          window.localStorage.setItem(YARD_THEME_STORAGE_KEY, detail)
        } catch {
          // ignore persistence failures (private mode etc.)
        }
      }
    }

    window.addEventListener("storage", onStorage)
    window.addEventListener(YARD_THEME_EVENT, onCustomTheme as EventListener)
    return () => {
      window.removeEventListener("storage", onStorage)
      window.removeEventListener(YARD_THEME_EVENT, onCustomTheme as EventListener)
    }
  }, [])

  const setThemeChoice = useCallback((choice: YardThemeChoice) => {
    setThemeChoiceState(choice)
    try {
      window.localStorage.setItem(YARD_THEME_STORAGE_KEY, choice)
    } catch {
      // ignore persistence failures
    }
    applyTierClass(resolveTierClass(tier, choice))
  }, [tier])

  useEffect(() => {
    if (isLoading) return
    applyTierClass(resolveTierClass(tier, themeChoice))
  }, [tier, isLoading, themeChoice])

  return (
    <ThemeContext.Provider value={{ tier, isLoading, themeChoice, setThemeChoice }}>
      {children}
    </ThemeContext.Provider>
  )
}

export function useTierTheme() {
  const context = useContext(ThemeContext)
  if (!context) throw new Error("useTierTheme must be used within ThemeProvider")
  return context
}
