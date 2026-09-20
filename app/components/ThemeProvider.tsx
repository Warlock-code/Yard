"use client"

import { createContext, useCallback, useContext, useEffect, useState, type ReactNode } from "react"
import { apiGet } from "@/lib/useApi"
import { getEffectiveTier } from "@/lib/tier"
import { THEME_CLASS_NAMES, THEME_MAP, isThemeId, isThemeUnlocked, type ThemeId } from "@/lib/themes"

type Tier = "FREE" | "PLUS" | "PRIME"

/** @deprecated kept for backwards-compat imports — use ThemeId from lib/themes instead. */
export type YardThemeChoice = ThemeId

export const YARD_THEME_STORAGE_KEY = "yard-theme"
export const YARD_THEME_EVENT = "yard-theme-change"

function readStoredTheme(): ThemeId | null {
  if (typeof window === "undefined") return null
  try {
    const v = window.localStorage.getItem(YARD_THEME_STORAGE_KEY)
    return isThemeId(v) ? v : null
  } catch {
    return null
  }
}

/** Nothing auto-switches anymore — every tier (incl. Prime) stays on Default
 *  Green until they explicitly pick an unlocked theme from Shop > Themes. */
function resolveThemeClassName(
  tier: Tier,
  ownedCosmetics: readonly string[],
  stored: ThemeId | null
): string {
  if (stored && isThemeUnlocked(stored, tier, ownedCosmetics)) {
    return THEME_MAP[stored].className
  }
  return THEME_MAP.default.className
}

function applyThemeClassName(className: string) {
  const root = document.documentElement
  root.classList.remove(...THEME_CLASS_NAMES)
  root.classList.add(className)
}

interface ThemeContextType {
  tier: Tier
  isLoading: boolean
  ownedCosmetics: string[]
  /** User's stored theme pick. `null` = unset (default). */
  themeChoice: ThemeId | null
  setThemeChoice: (choice: ThemeId) => void
}

const ThemeContext = createContext<ThemeContextType>({
  tier: "FREE",
  isLoading: true,
  ownedCosmetics: [],
  themeChoice: null,
  setThemeChoice: () => {},
})

export function ThemeProvider({ children }: { children: ReactNode }) {
  const [tier, setTier] = useState<Tier>("FREE")
  const [ownedCosmetics, setOwnedCosmetics] = useState<string[]>([])
  const [isLoading, setIsLoading] = useState(true)
  const [themeChoice, setThemeChoiceState] = useState<ThemeId | null>(null)

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
          setOwnedCosmetics(Array.isArray(data.user.ownedCosmetics) ? data.user.ownedCosmetics : [])
        }
      } catch {
        if (active) {
          setTier("FREE")
          setOwnedCosmetics([])
        }
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
      setThemeChoiceState(isThemeId(e.newValue) ? e.newValue : null)
    }

    const onCustomTheme = (e: Event) => {
      const detail = (e as CustomEvent<ThemeId>).detail
      if (isThemeId(detail)) {
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

  const setThemeChoice = useCallback((choice: ThemeId) => {
    if (!isThemeUnlocked(choice, tier, ownedCosmetics)) return
    setThemeChoiceState(choice)
    try {
      window.localStorage.setItem(YARD_THEME_STORAGE_KEY, choice)
    } catch {
      // ignore persistence failures
    }
    applyThemeClassName(THEME_MAP[choice].className)
  }, [tier, ownedCosmetics])

  useEffect(() => {
    if (isLoading) return
    applyThemeClassName(resolveThemeClassName(tier, ownedCosmetics, themeChoice))
  }, [tier, ownedCosmetics, isLoading, themeChoice])

  return (
    <ThemeContext.Provider value={{ tier, isLoading, ownedCosmetics, themeChoice, setThemeChoice }}>
      {children}
    </ThemeContext.Provider>
  )
}

export function useTierTheme() {
  const context = useContext(ThemeContext)
  if (!context) throw new Error("useTierTheme must be used within ThemeProvider")
  return context
}
