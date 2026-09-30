"use client"

import { useEffect, useState } from "react"
import { useRouter } from "next/navigation"
import { apiGet, apiPost } from "@/lib/useApi"
import { openPaystackCheckout } from "@/lib/purchaseGate"
import { TIER_CONFIG } from "@/lib/tier"
import { logPaywallHit } from "@/lib/logPaywall"

export default function UpgradePage() {
  const router = useRouter()
  const [me, setMe] = useState<{ tier: "FREE" | "PLUS" } | null>(null)
  const [loading, setLoading] = useState(false)

  useEffect(() => {
    logPaywallHit("upgrade_view", "/upgrade").catch(() => {})
  }, [])

  useEffect(() => {
    let active = true
    apiGet<{ user: { tier: "FREE" | "PLUS" } | null }>("/api/auth/me")
      .then((data) => {
        if (active) setMe(data.user)
      })
      .catch(() => {})
    return () => { active = false }
  }, [])

  async function handleSubscribe(tier: "plus") {
    if (!me || loading || me.tier === tier.toUpperCase()) return
    setLoading(true)
    try {
      const data = await apiPost<{ data?: { authorization_url?: string } }>(`/api/subscribe/${tier}`, {})
      if (data.data?.authorization_url) await openPaystackCheckout(data.data.authorization_url)
    } catch (err: unknown) {
      alert(err instanceof Error ? err.message : "something went wrong.")
    } finally {
      setLoading(false)
    }
  }

  const freeConfig = TIER_CONFIG.FREE
  const plusConfig = TIER_CONFIG.PLUS

  return (
    <main className="min-h-screen max-w-lg mx-auto pb-28 px-4">
      <div className="flex items-center gap-3 pt-5 pb-3">
        <button onClick={() => router.back()} className="text-white/60">←</button>
        <h1 className="text-xl font-bold">upgrade</h1>
      </div>

      {!me ? (
        <div className="space-y-4">
          <div className="card p-5 animate-pulse"><div className="h-4 w-32 bg-white/10 rounded mb-2" /><div className="h-3 w-full bg-white/5 rounded" /></div>
          <div className="card p-5 animate-pulse"><div className="h-4 w-32 bg-white/10 rounded mb-2" /><div className="h-3 w-full bg-white/5 rounded" /></div>
        </div>
      ) : me.tier === "PLUS" ? (
        <div className="card p-5 border-sky-500/30 bg-sky-500/5 relative overflow-hidden">
          <div className="absolute top-0 left-0 right-0 h-1 bg-gradient-to-r from-sky-500 to-blue-500" />
          <div className="flex items-center gap-2 mb-3">
            <span className="text-2xl">✨</span>
            <p className="font-bold text-lg text-sky-300">plus active</p>
          </div>
          <p className="text-white/60 text-sm mb-4">you have all plus perks — enjoy!</p>
          <div className="space-y-2 text-sm text-white/70">
            {plusConfig.perks.map((perk, i) => (
              <div key={i} className="flex items-center gap-2">
                <span className="text-sky-300">✓</span>
                <span>{perk}</span>
              </div>
            ))}
          </div>
        </div>
      ) : (
        <div className="space-y-4">
          <div className="card p-5 border-white/10 bg-white/5 relative overflow-hidden">
            <div className="absolute top-0 left-0 right-0 h-1 bg-white/10" />
            <div className="flex items-center gap-2 mb-3">
              <span className="text-2xl">👻</span>
              <p className="font-bold text-lg text-white">free plan</p>
            </div>
            <p className="text-white/50 text-sm mb-4">upgrade to plus for edit posts, common/rare avatars, blue checkmark, and more.</p>
            <div className="space-y-2 text-sm text-white/70 mb-4">
              {freeConfig.perks.map((perk, i) => (
                <div key={i} className="flex items-center gap-2">
                  <span className="text-white/40">•</span>
                  <span>{perk}</span>
                </div>
              ))}
            </div>
          </div>
          <button
            className="btn-primary w-full disabled:opacity-50 disabled:cursor-not-allowed"
            disabled={loading}
            onClick={() => handleSubscribe("plus")}
          >
            upgrade to plus — ghs 10/month
          </button>
        </div>
      )}
    </main>
  )
}