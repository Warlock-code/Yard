"use client"

import { useEffect, useState } from "react"
import { useRouter } from "next/navigation"
import { apiGet, apiPost } from "@/lib/useApi"
import { openPaystackCheckout } from "@/lib/purchaseGate"
import { AVATARS, getAvatarPriceForTier, getRarityColor, getRarityGlow, isAvatarUnlockedForTier } from "@/lib/avatars"
import { TIER_CONFIG } from "@/lib/tier"
import { useTierTheme } from "@/app/components/ThemeProvider"
import { THEMES, isThemeUnlocked, type ThemeId } from "@/lib/themes"
import { getAllPacks } from "@/lib/credits"
import type { CreditPack } from "@/lib/credit-config"

const CATEGORIES = [
  { key: "credits", label: "Credits", icon: "💳" },
  { key: "tier", label: "Upgrade" },
  { key: "boosts", label: "Boosts" },
  { key: "streak", label: "Streak" },
  { key: "avatars", label: "Avatars" },
  { key: "identity", label: "Identity" },
  { key: "themes", label: "Themes" },
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

  return (
    <div className="mt-2">
      <p className="text-white/40 text-xs mb-3 px-1">
        Default Green is on for everyone. Plus unlocks Blue, Prime unlocks Blue & Gold — all opt-in.
        Everyone can also buy extra colorways below.
      </p>
      <div className="grid grid-cols-2 gap-3">
        {THEMES.map((theme) => {
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
                  ? "✓ Active"
                  : unlocked
                    ? theme.description
                    : isPaid
                      ? theme.description
                      : theme.requiresTier === "PRIME"
                        ? "Prime perk"
                        : "Plus perk"}
              </p>
              {isActive ? (
                <button className="w-full text-sm btn-ghost" disabled>
                  ✓ Active
                </button>
              ) : unlocked ? (
                <button className="w-full text-sm btn-primary" onClick={() => onSelect(theme.id)}>
                  Use
                </button>
              ) : isPaid ? (
                <button
                  className="w-full text-sm btn-primary disabled:opacity-50 disabled:cursor-not-allowed"
                  disabled={buyingId !== null}
                  onClick={() => onBuy(theme.id)}
                >
                  {isBuying ? "..." : `Buy — ${theme.pricePesewas / 100} credits`}
                </button>
              ) : (
                <button className="w-full text-sm btn-ghost opacity-50 cursor-not-allowed" disabled>
                  🔒 {theme.requiresTier === "PRIME" ? "Prime" : "Plus"} only
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
    apiGet("/api/auth/me").then((d) => setMe(d.user)).catch(() => {})
    apiGet("/api/credits/balance").then((d) => setMe(prev => prev ? { ...prev, creditsBalance: d.balance } : null)).catch(() => {})
  }, [])

  async function buy(endpoint: string, key: string, body: Record<string, unknown> = {}) {
    setLoading(key)
    try {
      const data = await apiPost(endpoint, body)
      const url = data.data?.authorization_url as string | undefined
      if (url) {
        await openPaystackCheckout(url)
      } else if (data.status === true && !url) {
        throw new Error(data.message || "Checkout failed — no payment URL.")
      } else {
        alert(data.message || "Purchased!")
      }
    } catch (err: unknown) {
      alert(err instanceof Error ? err.message : "Something went wrong.")
    } finally {
      setLoading(null)
    }
  }

  async function buyCredits(packId: string) {
    setLoading(packId)
    try {
      const data = await apiPost("/api/credits/purchase", { packId })
      const url = data.authorization_url as string | undefined
      if (url) {
        await openPaystackCheckout(url)
      } else {
        alert(data.message || "Purchased!")
      }
    } catch (err: unknown) {
      alert(err instanceof Error ? err.message : "Something went wrong.")
    } finally {
      setLoading(null)
    }
  }

  async function buyWithCredits(endpoint: string, key: string, body: Record<string, unknown> = {}) {
    setLoading(key)
    try {
      const data = await apiPost(endpoint, body)
      if (data.status === true || data.message) {
        alert(data.message || "Purchased!")
        // Refresh credit balance
        const bal = await apiGet("/api/credits/balance")
        setMe(prev => prev ? { ...prev, creditsBalance: bal.balance } : null)
      } else {
        alert(data.error || "Failed")
      }
    } catch (err: unknown) {
      alert(err instanceof Error ? err.message : "Something went wrong.")
    } finally {
      setLoading(null)
    }
  }

  const getPriceDisplay = (avatar: typeof AVATARS[0]) => {
    if (!me) return `${avatar.pricePesewas / 100} credits`
    const price = getAvatarPriceForTier(me.tier, avatar)
    if (price === 0) return "Free"
    return `${price / 100} credits`
  }

  const isOwnedOrFree = (avatar: typeof AVATARS[0]) => {
    if (!me) return false
    if (me.ownedCosmetics?.includes(avatar.id)) return true
    if (isAvatarUnlockedForTier(me.tier, avatar.id)) return true
    return false
  }

  return (
    <main className="min-h-screen max-w-lg mx-auto pb-28 px-4">
      <div className="pt-5 pb-3">
        <h1 className="text-2xl font-black">The Shop</h1>
        <p className="text-white/40 text-sm">Gear up your ghost.</p>
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
          <span className="text-white/50 text-sm">Your Balance</span>
          <span className="text-lg font-bold text-primary">{me.creditsBalance?.toLocaleString() || 0} credits</span>
        </div>
      )}

      {category === "credits" && (
        <div className="space-y-3 mt-2">
          <p className="text-xs text-white/40 mb-2">Buy credits to spend on boosts, avatars, tips & more. 100 credits = GHS 1</p>
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
                  {loading === pack.id ? "..." : `Buy — GHS ${pack.ghs}`}
                </button>
              </div>
            ))}
          </div>
        </div>
      )}

      {category === "tier" && !me && (
        <div className="card p-5 mt-2 animate-pulse"><div className="h-4 w-24 bg-white/10 rounded mb-2" /><div className="h-3 w-full bg-white/5 rounded" /></div>
      )}
      {category === "tier" && me?.tier === "PRIME" && (
        <div className="card p-4 mt-2 border-[#facc15]/20 bg-[#facc15]/5 relative overflow-hidden">
          <div className="absolute top-0 left-0 right-0 h-1 bg-gradient-to-r from-[#facc15] to-[#d4a017]" />
          <p className="text-xs text-[#facc15] uppercase mb-1 font-bold">👑 Prime</p>
          <p className="font-semibold text-sm text-white/70">You&apos;re on the highest plan — no further upgrade.</p>
        </div>
      )}
      {category === "tier" && me?.tier === "PLUS" && (
        <div className="card p-5 mt-2 border-sky-500/30 bg-sky-500/5 relative overflow-hidden">
          <div className="absolute top-0 left-0 right-0 h-1 bg-gradient-to-r from-sky-500 to-blue-500" />
          <p className="text-xs text-sky-300 uppercase mb-1 font-bold">👑 Prime</p>
          <p className="font-bold text-lg mb-2">Upgrade to Prime — GHS 20</p>
          <p className="text-white/40 text-xs mb-3">You&apos;re on Plus — Prime adds earnings & all common avatars free.</p>
          <button
            className="btn-primary disabled:opacity-50 disabled:cursor-not-allowed"
            disabled={loading !== null}
            onClick={() => buy("/api/subscribe/prime", "prime")}
          >
            {loading === "prime" ? "..." : "Go Prime"}
          </button>
        </div>
      )}
      {category === "tier" && me?.tier === "FREE" && (
        <div className="space-y-3 mt-2">
          <div className="card p-5 relative overflow-hidden">
            <div className="absolute top-0 left-0 right-0 h-1 bg-gradient-to-r from-white/20 to-transparent" />
            <p className="text-xs text-white/40 uppercase mb-1">Plus — GHS 10</p>
            <p className="font-bold text-lg mb-2">More perks, more style</p>
            <button
              className="btn-ghost disabled:opacity-50 disabled:cursor-not-allowed"
              disabled={loading !== null}
              onClick={() => buy("/api/subscribe/plus", "plus")}
            >
              {loading === "plus" ? "..." : "Subscribe"}
            </button>
          </div>
          <div className="card p-5 border-[#facc15]/30 bg-[#facc15]/5 relative overflow-hidden">
            <div className="absolute top-0 left-0 right-0 h-1 bg-gradient-to-r from-[#facc15] to-[#d4a017]" />
            <p className="text-xs text-[#facc15] uppercase mb-1 font-bold">👑 Prime — GHS 20</p>
            <p className="font-bold text-lg mb-2">Every common avatar free. Real earnings. Highest priority.</p>
            <button
              className="btn-primary disabled:opacity-50 disabled:cursor-not-allowed"
              disabled={loading !== null}
              onClick={() => buy("/api/subscribe/prime", "prime")}
            >
              {loading === "prime" ? "..." : "Go Prime"}
            </button>
          </div>
        </div>
      )}

      {category === "boosts" && (
        <div className="grid grid-cols-2 gap-3 mt-2">
          <div className="card p-4 text-center">
            <p className="text-3xl mb-2">🚀</p>
            <p className="font-semibold text-sm">1 Boost Credit</p>
            <p className="text-white/40 text-xs mb-3">300 credits</p>
            <button className="btn-primary w-full text-sm" onClick={() => buyWithCredits("/api/shop/boost-credit", "boost", { useCredits: true })}>
              {loading === "boost" ? "..." : "Buy — 300 credits"}
            </button>
          </div>
          {me && me.freeBoosts > 0 && (
            <div className="card p-4 text-center border-sky-500/30 bg-sky-500/5">
              <p className="text-3xl mb-2">🚀</p>
              <p className="font-semibold text-sm">Free Boosts Available</p>
              <p className="text-sky-300 text-xs mb-3">{me.freeBoosts} boost{me.freeBoosts > 1 ? "s" : ""} this week</p>
              <button className="btn-ghost w-full text-sm" disabled>Use on post</button>
            </div>
          )}
        </div>
      )}

      {category === "streak" && (
        <div className="grid grid-cols-2 gap-3 mt-2">
          <div className="card p-4 text-center">
            <p className="text-3xl mb-2">🧊</p>
            <p className="font-semibold text-sm">Streak Freeze</p>
            <p className="text-white/40 text-xs mb-3">200 credits</p>
            <button className="btn-primary w-full text-sm" onClick={() => buyWithCredits("/api/shop/streak-freeze", "freeze", { useCredits: true })}>
              {loading === "freeze" ? "..." : "Buy — 200 credits"}
            </button>
          </div>
          <div className="card p-4 text-center">
            <p className="text-3xl mb-2">🔁</p>
            <p className="font-semibold text-sm">Restore Streak</p>
            <p className="text-white/40 text-xs mb-3">500 credits</p>
            <button className="btn-primary w-full text-sm" onClick={() => buyWithCredits("/api/shop/streak-restore", "restore", { useCredits: true })}>
              {loading === "restore" ? "..." : "Buy — 500 credits"}
            </button>
          </div>
          <div className="card p-4 text-center col-span-2">
            <p className="text-3xl mb-2">💾</p>
            <p className="font-semibold text-sm">Storage +100MB</p>
            <p className="text-white/40 text-xs mb-3">200 credits</p>
            <button className="btn-primary w-full text-sm" onClick={() => buyWithCredits("/api/shop/storage", "storage", { useCredits: true })}>
              {loading === "storage" ? "..." : "Buy — 200 credits"}
            </button>
          </div>
        </div>
      )}

      {category === "avatars" && (
        <div className="grid grid-cols-2 sm:grid-cols-3 gap-3 mt-2">
          {AVATARS.map((c) => {
            const owned = me?.ownedCosmetics?.includes(c.id)
            const freeForTier = me && isAvatarUnlockedForTier(me.tier, c.id)
            const price = me ? getAvatarPriceForTier(me.tier, c) : c.pricePesewas
            const isFree = price === 0
            const rarityClass = getRarityColor(c.rarity)
            const rarityGlow = getRarityGlow(c.rarity)
            return (
              <div key={c.id} className={`card p-4 text-center ${owned || isFree ? `border-${rarityClass.replace("text-", "")}/30 ${rarityGlow}` : ""}`}>
                <p className="text-3xl mb-2">{c.emoji}</p>
                <p className="font-semibold text-sm">{c.name}</p>
                <p className={`text-xs uppercase ${rarityClass}`}>{c.rarity}</p>
                <p className={`text-xs mb-3 ${isFree ? "text-primary" : "text-white/40"}`}>
                  {owned ? "✓ Owned" : isFree ? "Free (Prime)" : `${price / 100} credits`}
                </p>
                <button
                  className={`w-full text-sm ${owned || isFree ? "btn-ghost" : "btn-primary"}`}
                  disabled={owned || isFree || loading === c.id}
                  onClick={() => buyWithCredits("/api/shop/cosmetic", c.id, { cosmeticId: c.id, useCredits: true })}
                >
                  {owned ? "✓ Owned" : isFree ? "✓ Free" : loading === c.id ? "..." : `Buy — ${price / 100} credits`}
                </button>
              </div>
            )
          })}
        </div>
      )}

      {category === "identity" && (
        <div className="card p-4 mt-2">
          <p className="font-semibold text-sm mb-1">✏️ Custom Ghost Name</p>
          <p className="text-white/40 text-xs mb-3">300 credits — change from your Lair page.</p>
          <button className="btn-ghost" onClick={() => router.push("/lair")}>
            Go to Lair
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