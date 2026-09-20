"use client"

import { useEffect, useState } from "react"
import { useRouter } from "next/navigation"
import { apiGet, apiPost } from "@/lib/useApi"
import { openPaystackCheckout } from "@/lib/purchaseGate"
import { AVATARS, getAvatarPriceForTier, getRarityColor, getRarityGlow, isAvatarUnlockedForTier } from "@/lib/avatars"
import { TIER_CONFIG } from "@/lib/tier"

const CATEGORIES = [
  { key: "tier", label: "Upgrade" },
  { key: "boosts", label: "Boosts" },
  { key: "streak", label: "Streak" },
  { key: "avatars", label: "Avatars" },
  { key: "identity", label: "Identity" },
]

export default function ShopPage() {
  const router = useRouter()
  const [category, setCategory] = useState("tier")
  const [loading, setLoading] = useState<string | null>(null)
  const [me, setMe] = useState<{ tier: "FREE" | "PLUS" | "PRIME"; ownedCosmetics: string[]; freeBoosts: number } | null>(null)

  useEffect(() => {
    apiGet("/api/auth/me").then((d) => setMe(d.user)).catch(() => {})
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

  const getPriceDisplay = (avatar: typeof AVATARS[0]) => {
    if (!me) return `GHS ${(avatar.pricePesewas / 100).toFixed(2)}`
    const price = getAvatarPriceForTier(me.tier, avatar)
    if (price === 0) return "Free"
    return `GHS ${(price / 100).toFixed(2)}`
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
            {c.label}
          </button>
        ))}
      </div>

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
            <p className="text-white/40 text-xs mb-3">GHS 5.00</p>
            <button className="btn-primary w-full text-sm" onClick={() => buy("/api/shop/boost-credit", "boost")}>
              {loading === "boost" ? "..." : "Buy"}
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
            <p className="text-white/40 text-xs mb-3">GHS 2.00</p>
            <button className="btn-primary w-full text-sm" onClick={() => buy("/api/shop/streak-freeze", "freeze")}>
              {loading === "freeze" ? "..." : "Buy"}
            </button>
          </div>
          <div className="card p-4 text-center">
            <p className="text-3xl mb-2">🔁</p>
            <p className="font-semibold text-sm">Restore Streak</p>
            <p className="text-white/40 text-xs mb-3">GHS 3.00</p>
            <button className="btn-primary w-full text-sm" onClick={() => buy("/api/shop/streak-restore", "restore")}>
              {loading === "restore" ? "..." : "Buy"}
            </button>
          </div>
          <div className="card p-4 text-center col-span-2">
            <p className="text-3xl mb-2">💾</p>
            <p className="font-semibold text-sm">Storage +100MB</p>
            <p className="text-white/40 text-xs mb-3">GHS 10.00</p>
            <button className="btn-primary w-full text-sm" onClick={() => buy("/api/shop/storage", "storage")}>
              {loading === "storage" ? "..." : "Buy"}
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
                  {owned ? "✓ Owned" : isFree ? "Free (Prime)" : `GHS ${(price / 100).toFixed(2)}`}
                </p>
                <button
                  className={`w-full text-sm ${owned || isFree ? "btn-ghost" : "btn-primary"}`}
                  disabled={owned || isFree || loading === c.id}
                  onClick={() => buy("/api/shop/cosmetic", c.id, { cosmeticId: c.id })}
                >
                  {owned ? "✓ Owned" : isFree ? "✓ Free" : loading === c.id ? "..." : "Buy"}
                </button>
              </div>
            )
          })}
        </div>
      )}

      {category === "identity" && (
        <div className="card p-4 mt-2">
          <p className="font-semibold text-sm mb-1">✏️ Custom Ghost Name</p>
          <p className="text-white/40 text-xs mb-3">GHS 5.00 — change from your Lair page.</p>
          <button className="btn-ghost" onClick={() => router.push("/lair")}>
            Go to Lair
          </button>
        </div>
      )}
    </main>
  )
}