"use client"

import { useEffect, useState } from "react"
import { useRouter } from "next/navigation"
import { apiGet, apiPost } from "@/lib/useApi"
import { openPaystackCheckout } from "@/lib/purchaseGate"
import { AVATARS, getAvatarPriceForTier, getRarityColor, getRarityGlow } from "@/lib/avatars"
import { useTierTheme } from "@/app/components/ThemeProvider"
import { THEMES, isThemeUnlocked, themeCosmeticId, type ThemeId } from "@/lib/themes"
import { getAllPacks } from "@/lib/credits"
import type { CreditPack } from "@/lib/credit-config"

const CATEGORIES = [
  { key: "credits", label: "credits", icon: "💳" },
  { key: "tier", label: "upgrade" },
  { key: "boosts", label: "boosts" },
  { key: "streak", label: "streak" },
  { key: "avatars", label: "avatars" },
  { key: "identity", label: "identity" },
  { key: "themes", label: "themes" },
]

function ThemesPicker({
  tier,
  ownedCosmetics,
  themeChoice,
  buyingId,
  onSelect,
  onBuy,
}: {
  tier: "FREE" | "PLUS" | "PRIME"
  ownedCosmetics: string[]
  themeChoice: ThemeId | null
  buyingId: string | null
  onSelect: (value: ThemeId) => void
  onBuy: (value: ThemeId) => void
}) {
  const activeId: ThemeId = themeChoice && isThemeUnlocked(themeChoice, tier, ownedCosmetics) ? themeChoice : "default"

  // One-time buys leave the shop once owned — use them from owned.
  // Additive filter only: purchasable themes you already own are hidden,
  // free / tier-perk themes stay visible so plus gating never changes.
  const visibleThemes = THEMES.filter((theme) => {
    if (theme.requiresTier === "PRIME") return false
    if (theme.pricePesewas > 0 && ownedCosmetics.includes(themeCosmeticId(theme.id))) return false
    return true
  })

  if (visibleThemes.length === 0) {
    return (
      <div className="mt-2 card p-5 text-center">
        <p className="font-semibold text-sm">all themes owned 🎨</p>
        <p className="text-white/40 text-xs mt-1">find everything in owned.</p>
      </div>
    )
  }

  return (
    <div className="mt-2">
      <p className="text-white/40 text-xs mb-3 px-1">
        default green is on for everyone. plus unlocks blue — all opt-in.
        everyone can also buy extra colorways below. owned themes live in owned.
      </p>
      <div className="grid grid-cols-2 gap-3">
        {visibleThemes.map((theme) => {
          const isActive = activeId === theme.id
          const unlocked = isThemeUnlocked(theme.id, tier, ownedCosmetics)
          const isPaid = theme.pricePesewas > 0
          const isBuying = buyingId === theme.id

          return (
            <div
              key={theme.id}
              className={`card p-4 text-center ${isActive ? `${theme.activeBorderClass} ${theme.activeBgClass}` : ""}`}
            >
              <div
                className="mx-auto mb-2 h-12 w-12 rounded-full border border-white/10"
                style={{ background: `linear-gradient(135deg, ${theme.swatchFrom} 50%, ${theme.swatchTo} 50%)` }}
              />
              <p className="font-semibold text-sm">{theme.name}</p>
              <p className={`text-xs mb-3 ${isActive ? theme.activeTextClass : "text-white/40"}`}>
                {isActive
                  ? "✓ active"
                  : unlocked
                    ? theme.description
                    : isPaid
                      ? theme.description
                      : "plus perk"}
              </p>
              {isActive ? (
                <button className="w-full text-sm btn-ghost" disabled>
                  ✓ active
                </button>
              ) : unlocked ? (
                <button className="w-full text-sm btn-primary" onClick={() => onSelect(theme.id)}>
                  use
                </button>
              ) : isPaid ? (
                <button
                  className="w-full text-sm btn-primary disabled:opacity-50 disabled:cursor-not-allowed"
                  disabled={buyingId !== null}
                  onClick={() => onBuy(theme.id)}
                >
                  {isBuying ? "..." : `buy — ${theme.pricePesewas / 100} credits`}
                </button>
              ) : (
                <button className="w-full text-sm btn-ghost opacity-50 cursor-not-allowed" disabled>
                  🔒 plus only
                </button>
              )}
            </div>
          )
        })}
      </div>
    </div>
  )
}

export default function ShopPage() {
  const router = useRouter()
  const [category, setCategory] = useState("credits")
  const [loading, setLoading] = useState<string | null>(null)
  const [me, setMe] = useState<{ tier: "FREE" | "PLUS" | "PRIME"; ownedCosmetics: string[]; freeBoosts: number; creditsBalance: number } | null>(null)
  const { themeChoice, setThemeChoice } = useTierTheme()

  useEffect(() => {
    apiGet<{ user: { tier: "FREE" | "PLUS"; ownedCosmetics: string[]; freeBoosts?: number } | null }>("/api/auth/me").then((d) => {
      if (d.user) {
        const u = d.user
        setMe((prev) => ({ tier: u.tier, ownedCosmetics: u.ownedCosmetics, freeBoosts: u.freeBoosts ?? prev?.freeBoosts ?? 0, creditsBalance: prev?.creditsBalance ?? 0 }))
      }
    }).catch(() => {})
    apiGet<{ balance: number }>("/api/credits/balance").then((d) => setMe(prev => prev ? { ...prev, creditsBalance: d.balance } : null)).catch(() => {})
  }, [])

  async function buy(endpoint: string, key: string, body: Record<string, unknown> = {}) {
    setLoading(key)
    try {
      const data = await apiPost<{ data?: { authorization_url?: string }; status?: boolean; message?: string }>(endpoint, body)
      const url = data.data?.authorization_url as string | undefined
      if (url) {
        await openPaystackCheckout(url)
      } else if (data.status === true && !url) {
        throw new Error(data.message || "checkout failed — no payment url.")
      } else {
        alert(data.message || "purchased!")
      }
    } catch (err: unknown) {
      alert(err instanceof Error ? err.message : "something went wrong.")
    } finally {
      setLoading(null)
    }
  }

  async function buyCredits(packId: string) {
    setLoading(packId)
    try {
      const data = await apiPost<{ authorization_url?: string; message?: string }>("/api/credits/purchase", { packId })
      const url = data.authorization_url as string | undefined
      if (url) {
        await openPaystackCheckout(url)
      } else {
        alert(data.message || "purchased!")
      }
    } catch (err: unknown) {
      alert(err instanceof Error ? err.message : "something went wrong.")
    } finally {
      setLoading(null)
    }
  }

  async function buyWithCredits(endpoint: string, key: string, body: Record<string, unknown> = {}) {
    setLoading(key)
    try {
      const data = await apiPost<{ status?: boolean; success?: boolean; message?: string; error?: string }>(endpoint, body)
      if (data.status === true || data.success === true || data.message) {
        alert(data.message || "purchased!")
        // Refresh balance + owned items so buttons flip to "owned" immediately
        try {
          const [bal, fresh] = await Promise.all([
            apiGet<{ balance: number }>("/api/credits/balance"),
            apiGet<{ user: { tier: "FREE" | "PLUS"; ownedCosmetics: string[]; freeBoosts?: number } | null }>("/api/auth/me"),
          ])
          setMe(prev => {
            const u = fresh.user
            if (!u) return prev ? { ...prev, creditsBalance: bal.balance } : prev
            return { tier: u.tier, ownedCosmetics: u.ownedCosmetics || [], freeBoosts: u.freeBoosts ?? prev?.freeBoosts ?? 0, creditsBalance: bal.balance }
          })
        } catch {
          const bal = await apiGet<{ balance: number }>("/api/credits/balance").catch(() => null)
          if (bal) setMe(prev => prev ? { ...prev, creditsBalance: bal.balance } : null)
        }
      } else {
        alert(data.error || "failed")
      }
    } catch (err: unknown) {
      alert(err instanceof Error ? err.message : "something went wrong.")
    } finally {
      setLoading(null)
    }
  }

  return (
    <main className="min-h-screen max-w-lg mx-auto pb-28 px-4">
      <div className="pt-5 pb-3">
        <h1 className="text-2xl font-black">the shop</h1>
        <p className="text-white/40 text-sm">gear up your ghost.</p>
      </div>

      <div className="flex gap-2 overflow-x-auto pb-3 -mx-1 px-1">
        {CATEGORIES.map((c) => (
          <button
            key={c.key}
            onClick={() => setCategory(c.key)}
            className={`whitespace-nowrap text-xs px-4 py-2 rounded-full border ${
              category === c.key ? "border-primary text-primary bg-primary/10" : "border-white/10 text-white/40"
            }`}
          >
            {(c as { icon?: string }).icon ? `${(c as { icon?: string }).icon} ` : ""}{c.label}
          </button>
        ))}
      </div>

      {me && (
        <div className="card p-3 mb-3 flex items-center justify-between">
          <span className="text-white/50 text-sm">your balance</span>
          <span className="text-lg font-bold text-primary">{me.creditsBalance?.toLocaleString() || 0} credits</span>
        </div>
      )}

      {category === "credits" && (
        <div className="space-y-3 mt-2">
          <button className="card w-full p-3 flex items-center justify-between" onClick={() => router.push("/tips")}>
            <span className="text-sm">🎁 tip someone with credits</span>
            <span className="text-white/40 text-sm">→</span>
          </button>
          <div className="grid grid-cols-2 gap-3">
            {getAllPacks().map((pack: CreditPack) => (
              <div key={pack.id} className="card p-4 text-center relative">
                {pack.bonusPct > 0 && (
                  <span className="absolute top-1 right-1 text-xs bg-primary text-black px-2 py-0.5 rounded">
                    +{pack.bonusPct}%
                  </span>
                )}
                <p className="text-3xl font-bold text-primary mb-1">{pack.credits.toLocaleString()}</p>
                <p className="text-xs text-white/40 mb-2">credits</p>
                <p className="text-sm font-semibold mb-1">{pack.name}</p>
                <p className="text-xs text-white/50 mb-3">{pack.description}</p>
                <button
                  className="btn-primary w-full text-sm disabled:opacity-50"
                  disabled={loading === pack.id}
                  onClick={() => buyCredits(pack.id)}
                >
                  {loading === pack.id ? "..." : `buy — ghs ${pack.ghs}`}
                </button>
              </div>
            ))}
          </div>
        </div>
      )}

      {category === "tier" && !me && (
        <div className="card p-5 mt-2 animate-pulse"><div className="h-4 w-24 bg-white/10 rounded mb-2" /><div className="h-3 w-full bg-white/5 rounded" /></div>
      )}
      {category === "tier" && (me?.tier === "PLUS" || me?.tier === "PRIME") && (
        <div className="card p-5 mt-2 border-sky-500/30 bg-sky-500/5 relative overflow-hidden">
          <div className="absolute top-0 left-0 right-0 h-1 bg-gradient-to-r from-sky-500 to-blue-500" />
          <p className="text-xs text-sky-300 uppercase mb-1 font-bold">✓ plus</p>
          <p className="font-semibold text-sm text-white/70">you&apos;re on the highest plan — no further upgrade.</p>
        </div>
      )}
      {category === "tier" && me?.tier === "FREE" && (
        <div className="space-y-3 mt-2">
          <div className="card p-5 relative overflow-hidden">
            <div className="absolute top-0 left-0 right-0 h-1 bg-gradient-to-r from-white/20 to-transparent" />
            <p className="text-xs text-white/40 uppercase mb-1">plus — ghs 10</p>
            <p className="font-bold text-lg mb-2">more perks, more style</p>
            <p className="text-white/50 text-sm mb-3">compare free vs plus, then checkout.</p>
            <button
              className="btn-ghost disabled:opacity-50 disabled:cursor-not-allowed"
              disabled={loading !== null}
              onClick={() => router.push("/upgrade")}
            >
              compare plans →
            </button>
          </div>
        </div>
      )}

      {category === "boosts" && (
        <div className="grid grid-cols-2 gap-3 mt-2">
          <div className="card p-4 text-center">
            <p className="text-3xl mb-2">🚀</p>
            <p className="font-semibold text-sm">1 boost credit</p>
            <p className="text-white/40 text-xs mb-3">300 credits</p>
            <button className="btn-primary w-full text-sm" onClick={() => buyWithCredits("/api/shop/boost-credit", "boost", { useCredits: true })}>
              {loading === "boost" ? "..." : "buy — 300 credits"}
            </button>
          </div>
          {me && me.freeBoosts > 0 && (
            <div className="card p-4 text-center border-sky-500/30 bg-sky-500/5">
              <p className="text-3xl mb-2">🚀</p>
              <p className="font-semibold text-sm">free boosts available</p>
              <p className="text-sky-300 text-xs mb-3">{me.freeBoosts} boost{me.freeBoosts > 1 ? "s" : ""} this week</p>
              <button className="btn-ghost w-full text-sm" disabled>use on post</button>
            </div>
          )}
        </div>
      )}

      {category === "streak" && (
        <div className="grid grid-cols-2 gap-3 mt-2">
          <div className="card p-4 text-center">
            <p className="text-3xl mb-2">🧊</p>
            <p className="font-semibold text-sm">streak freeze</p>
            <p className="text-white/40 text-xs mb-3">200 credits · 48h protection</p>
            <button className="btn-primary w-full text-sm" onClick={() => buyWithCredits("/api/shop/streak-freeze", "freeze", { useCredits: true })}>
              {loading === "freeze" ? "..." : "buy — 200 credits"}
            </button>
          </div>
          <div className="card p-4 text-center">
            <p className="text-3xl mb-2">🔁</p>
            <p className="font-semibold text-sm">restore streak</p>
            <p className="text-white/40 text-xs mb-3">500 credits</p>
            <button className="btn-primary w-full text-sm" onClick={() => buyWithCredits("/api/shop/streak-restore", "restore", { useCredits: true })}>
              {loading === "restore" ? "..." : "buy — 500 credits"}
            </button>
          </div>
          <div className="card p-4 text-center col-span-2">
            <p className="text-3xl mb-2">💾</p>
            <p className="font-semibold text-sm">storage +100mb</p>
            <p className="text-white/40 text-xs mb-3">200 credits</p>
            <button className="btn-primary w-full text-sm" onClick={() => buyWithCredits("/api/shop/storage", "storage", { useCredits: true })}>
              {loading === "storage" ? "..." : "buy — 200 credits"}
            </button>
          </div>
        </div>
      )}

      {category === "avatars" && (() => {
        // One-time avatars leave the shop once owned — find them in owned.
        // Frontend-only filter; API still guards with "already owned".
        const visibleAvatars = AVATARS.filter((c) => !(me?.ownedCosmetics?.includes(c.id)))
        if (visibleAvatars.length === 0) {
          return (
            <div className="card p-5 mt-2 text-center">
              <p className="font-semibold text-sm">all avatars owned 👻</p>
              <p className="text-white/40 text-xs mt-1">find everything in owned.</p>
              <button className="btn-ghost mt-3 text-sm" onClick={() => router.push("/owned")}>
                go to owned →
              </button>
            </div>
          )
        }
        return (
          <div>
            <p className="text-white/40 text-xs mb-3 px-1">owned avatars live in owned — they leave the shop once bought.</p>
            <div className="grid grid-cols-2 sm:grid-cols-3 gap-3 mt-2">
              {visibleAvatars.map((c) => {
                const price = me ? getAvatarPriceForTier(me.tier, c) : c.pricePesewas
                const isFree = price === 0
                const rarityClass = getRarityColor(c.rarity)
                const rarityGlow = getRarityGlow(c.rarity)
                return (
                  <div key={c.id} className={`card p-4 text-center ${isFree ? `border-${rarityClass.replace("text-", "")}/30 ${rarityGlow}` : ""}`}>
                    <p className="text-3xl mb-2">{c.emoji}</p>
                    <p className="font-semibold text-sm">{c.name}</p>
                    <p className={`text-xs uppercase ${rarityClass}`}>{c.rarity}</p>
                    <p className={`text-xs mb-3 ${isFree ? "text-primary" : "text-white/40"}`}>
                      {isFree ? "free with plus" : `${price / 100} credits`}
                    </p>
                    <button
                      className={`w-full text-sm ${isFree ? "btn-ghost" : "btn-primary"}`}
                      disabled={isFree || loading === c.id}
                      onClick={() => buyWithCredits("/api/shop/cosmetic", c.id, { cosmeticId: c.id, useCredits: true })}
                    >
                      {isFree ? "✓ free" : loading === c.id ? "..." : `buy — ${price / 100} credits`}
                    </button>
                  </div>
                )
              })}
            </div>
          </div>
        )
      })()}

      {category === "identity" && (
        <div className="card p-4 mt-2">
          <p className="font-semibold text-sm mb-1">✏️ custom ghost name</p>
          <p className="text-white/40 text-xs mb-3">500 credits — credits only. change it from your lair page.</p>
          <button className="btn-ghost" onClick={() => router.push("/lair")}>
            go to lair
          </button>
        </div>
      )}

      {category === "themes" && !me && (
        <div className="card p-5 mt-2 animate-pulse"><div className="h-4 w-24 bg-white/10 rounded mb-2" /><div className="h-3 w-full bg-white/5 rounded" /></div>
      )}
      {category === "themes" && me && (
        <ThemesPicker
          tier={me.tier}
          ownedCosmetics={me.ownedCosmetics || []}
          themeChoice={themeChoice}
          buyingId={loading}
          onSelect={(value) => {
            try {
              window.localStorage.setItem("yard-theme", value)
            } catch {
              // ignore persistence failures
            }
            try {
              setThemeChoice(value)
            } catch {
              // context setter unavailable — custom event below still notifies ThemeProvider
            }
            try {
              window.dispatchEvent(new CustomEvent("yard-theme-change", { detail: value }))
            } catch {
              // ignore dispatch failures
            }
          }}
          onBuy={(themeId) => buyWithCredits("/api/shop/theme", themeId, { themeId, useCredits: true })}
        />
      )}
    </main>
  )
}