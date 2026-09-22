"use client"

import { useEffect, useState } from "react"
import { useRouter } from "next/navigation"
import { apiGet, apiPost } from "@/lib/useApi"
import { openPaystackCheckout } from "@/lib/purchaseGate"
import { TIER_CONFIG } from "@/lib/tier"
import { logPaywallHit } from "@/lib/logPaywall"

export default function UpgradePage() {
  const router = useRouter()
  const [me, setMe] = useState<{ tier: "FREE" | "PLUS" | "PRIME" } | null>(null)
  const [loading, setLoading] = useState(false)

  useEffect(() => {
    logPaywallHit("upgrade_view", "/upgrade").catch(() => {})
  }, [])

  useEffect(() => {
    let active = true
    apiGet("/api/auth/me")
      .then((data) => {
        if (active) setMe(data.user)
      })
      .catch(() => {})
    return () => { active = false }
  }, [])

  async function handleSubscribe(tier: "plus" | "prime") {
    if (!me || loading || me.tier === "PRIME" || (tier === "plus" && me.tier === "PLUS")) return
    setLoading(true)
    try {
      const data = await apiPost(`/api/subscribe/${tier}`, {})
      if (data.data?.authorization_url) await openPaystackCheckout(data.data.authorization_url)
    } catch (err: unknown) {
      alert(err instanceof Error ? err.message : "Something went wrong.")
    } finally {
      setLoading(false)
    }
  }

  const freeConfig = TIER_CONFIG.FREE
  const plusConfig = TIER_CONFIG.PLUS
  const primeConfig = TIER_CONFIG.PRIME

  return (
    <main className="min-h-screen max-w-lg mx-auto pb-28 px-4">
      <div className="flex items-center gap-3 pt-5 pb-3">
        <button onClick={() => router.back()} className="text-white/60">←</button>
        <h1 className="text-xl font-bold">Upgrade</h1>
      </div>

      {!me ? (
        <div className="space-y-4">
          <div className="card p-5 animate-pulse"><div className="h-4 w-32 bg-white/10 rounded mb-2" /><div className="h-3 w-full bg-white/5 rounded" /></div>
          <div className="card p-5 animate-pulse"><div className="h-4 w-32 bg-white/10 rounded mb-2" /><div className="h-3 w-full bg-white/5 rounded" /></div>
        </div>
      ) : me.tier === "PRIME" ? (
        <div className="card p-5 border-[#facc15]/30 bg-[#facc15]/5 relative overflow-hidden">
          <div className="absolute top-0 left-0 right-0 h-1 bg-gradient-to-r from-[#facc15] to-[#d4a017]" />
          <div className="flex items-center gap-2 mb-3">
            <span className="text-2xl">👑</span>
            <p className="font-bold text-lg text-[#facc15]">Prime Active</p>
          </div>
          <p className="text-white/60 text-sm mb-4">You have all perks — no need to upgrade again.</p>
          <div className="space-y-2 text-sm text-white/70">
            {primeConfig.perks.map((perk, i) => (
              <div key={i} className="flex items-center gap-2">
                <span className="text-[#facc15]">✓</span>
                <span>{perk}</span>
              </div>
            ))}
          </div>
        </div>
      ) : me.tier === "PLUS" ? (
        <div className="space-y-4">
          <div className="card p-5 border-sky-500/30 bg-sky-500/5 relative overflow-hidden">
            <div className="absolute top-0 left-0 right-0 h-1 bg-gradient-to-r from-sky-500 to-blue-500" />
            <div className="flex items-center gap-2 mb-3">
              <span className="text-2xl">✨</span>
              <p className="font-bold text-lg text-sky-300">Plus Active</p>
            </div>
            <p className="text-white/50 text-xs mb-4">Upgrade to Prime for earnings & all common avatars free.</p>
            <div className="space-y-2 text-sm text-white/70 mb-4">
              {plusConfig.perks.map((perk, i) => (
                <div key={i} className="flex items-center gap-2">
                  <span className="text-sky-300">✓</span>
                  <span>{perk}</span>
                </div>
              ))}
            </div>
            <button
              className="btn-primary w-full disabled:opacity-50 disabled:cursor-not-allowed"
              disabled={loading}
              onClick={() => handleSubscribe("prime")}
            >
              Go Prime — GHS 20/month
            </button>
          </div>
        </div>
      ) : (
        <>
          <div className="card p-5 mb-4 relative overflow-hidden">
            <div className="absolute top-0 left-0 right-0 h-1 bg-gradient-to-r from-white/20 to-transparent" />
            <div className="flex items-center gap-2 mb-3">
              <span className="text-2xl">✨</span>
              <p className="font-bold text-lg">Plus — GHS 10/month</p>
            </div>
            <p className="text-white/50 text-xs mb-3">More perks, more style</p>
            <div className="space-y-2 text-sm text-white/70 mb-4">
              {plusConfig.perks.map((perk, i) => (
                <div key={i} className="flex items-center gap-2">
                  <span className="text-sky-300">✓</span>
                  <span>{perk}</span>
                </div>
              ))}
            </div>
            <button
              className="btn-ghost w-full disabled:opacity-50 disabled:cursor-not-allowed"
              disabled={loading}
              onClick={() => handleSubscribe("plus")}
            >
              Get Plus
            </button>
          </div>

          <div className="card p-5 border-[#facc15]/30 bg-[#facc15]/5 relative overflow-hidden">
            <div className="absolute top-0 left-0 right-0 h-1 bg-gradient-to-r from-[#facc15] to-[#d4a017]" />
            <div className="flex items-center gap-2 mb-3">
              <span className="text-2xl">👑</span>
              <p className="font-bold text-lg text-[#facc15]">Prime — GHS 20/month</p>
            </div>
            <p className="text-white/50 text-xs mb-3">Every common avatar free. Real earnings. Highest priority.</p>
            <div className="space-y-2 text-sm text-white/70 mb-4">
              {primeConfig.perks.map((perk, i) => (
                <div key={i} className="flex items-center gap-2">
                  <span className="text-[#facc15]">✓</span>
                  <span>{perk}</span>
                </div>
              ))}
            </div>
            <button
              className="btn-primary w-full disabled:opacity-50 disabled:cursor-not-allowed"
              disabled={loading}
              onClick={() => handleSubscribe("prime")}
            >
              Go Prime
            </button>
          </div>
        </>
      )}
    </main>
  )
}