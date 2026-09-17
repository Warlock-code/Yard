"use client"

import { useEffect, useState } from "react"
import { useRouter } from "next/navigation"
import { apiGet, apiPost } from "@/lib/useApi"
import { blockIfNative } from "@/lib/purchaseGate"
import { AVATARS } from "@/lib/avatars"

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
  const [me, setMe] = useState<{ tier: "FREE" | "PLUS" | "PRIME"; ownedCosmetics: string[] } | null>(null)

  useEffect(() => {
    apiGet("/api/auth/me").then((d) => setMe(d.user)).catch(() => {})
  }, [])

  async function buy(endpoint: string, key: string, body: Record<string, unknown> = {}) {
    if (blockIfNative()) return
    setLoading(key)
    try {
      const data = await apiPost(endpoint, body)
      if (data.data?.authorization_url) {
        window.location.href = data.data.authorization_url
      } else {
        alert("Purchased!")
      }
    } catch (err: unknown) {
      alert(err instanceof Error ? err.message : "Something went wrong.")
    } finally {
      setLoading(null)
    }
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
              category === c.key ? "border-[#baff39] text-[#baff39] bg-[#baff39]/10" : "border-white/10 text-white/40"
            }`}
          >
            {c.label}
          </button>
        ))}
      </div>

      {category === "tier" && me?.tier === "PRIME" && (
        <div className="card p-4 mt-2">
          <p className="text-xs text-[#facc15] uppercase mb-1 font-bold">👑 Prime</p>
          <p className="font-semibold text-sm text-white/70">You&apos;re on the highest plan.</p>
        </div>
      )}

      {category === "tier" && me?.tier !== "PRIME" && (
        <div className="space-y-3 mt-2">
          {me?.tier !== "PLUS" && (
            <div className="card p-5">
              <p className="text-xs text-white/40 uppercase mb-1">Plus</p>
              <p className="font-bold text-lg mb-2">More perks, more style</p>
              <button
                className="btn-ghost disabled:opacity-50 disabled:cursor-not-allowed"
                disabled={!me || loading !== null}
                onClick={() => buy("/api/subscribe/plus", "plus")}
              >
                {loading === "plus" ? "..." : "Subscribe"}
              </button>
            </div>
          )}
          <div className="card p-5 border-[#facc15]/30">
            <p className="text-xs text-[#facc15] uppercase mb-1 font-bold">👑 Prime</p>
            <p className="font-bold text-lg mb-2">Every tier avatar. Real earnings. Early access.</p>
            <button
              className="btn-primary disabled:opacity-50 disabled:cursor-not-allowed"
              disabled={!me || loading !== null}
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
            const rarityClass = {
              common: "text-white/40",
              rare: "text-sky-300",
              epic: "text-fuchsia-300",
              legendary: "text-[#facc15]",
            }[c.rarity]
            return (
              <div key={c.id} className="card p-4 text-center">
                <p className="text-3xl mb-2">{c.emoji}</p>
                <p className="font-semibold text-sm">{c.name}</p>
                <p className={`text-xs uppercase ${rarityClass}`}>{c.rarity}</p>
                <p className="text-white/40 text-xs mb-3">{owned ? "Owned" : `GHS ${(c.pricePesewas / 100).toFixed(2)}`}</p>
                <button
                  className="btn-primary w-full text-sm"
                  disabled={owned}
                  onClick={() => buy("/api/shop/cosmetic", c.id, { cosmeticId: c.id })}
                >
                  {owned ? "✓ Owned" : loading === c.id ? "..." : "Buy"}
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