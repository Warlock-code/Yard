"use client"

import { useEffect, useState } from "react"
import { useRouter } from "next/navigation"
import { apiGet, apiPost } from "@/lib/useApi"
import { openPaystackCheckout } from "@/lib/purchaseGate"

export default function UpgradePage() {
  const router = useRouter()
  const [me, setMe] = useState<{ tier: "FREE" | "PLUS" | "PRIME" } | null>(null)
  const [loading, setLoading] = useState(false)

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
        <div className="card p-5 border-[#facc15]/30 bg-[#facc15]/5">
          <p className="font-bold text-lg mb-1 text-[#facc15]">👑 You&apos;re on Prime</p>
          <p className="text-white/60 text-sm">You have all perks — no need to upgrade again.</p>
        </div>
      ) : me.tier === "PLUS" ? (
        <div className="card p-5 border-[#facc15]/30">
          <p className="font-bold text-lg mb-1 text-[#facc15]">👑 Prime — GHS 20/month</p>
          <p className="text-white/50 text-xs mb-2">You&apos;re on Plus — upgrade to Prime for earnings & all avatars.</p>
          <ul className="text-sm text-white/70 space-y-1 mb-4 mt-2">
            <li>✓ Everything in Plus</li>
            <li>✓ All tier avatars unlocked</li>
            <li>✓ Real cash earnings from votes & battle wins</li>
            <li>✓ Request payouts (min GHS 20)</li>
            <li>✓ Early access to new features</li>
          </ul>
          <button
            className="btn-primary w-full disabled:opacity-50 disabled:cursor-not-allowed"
            disabled={loading}
            onClick={() => handleSubscribe("prime")}
          >
            Go Prime
          </button>
        </div>
      ) : (
        <>
          <div className="card p-5 mb-4">
            <p className="font-bold text-lg mb-1">Plus — GHS 10/month</p>
            <ul className="text-sm text-white/70 space-y-1 mb-4 mt-2">
              <li>✓ 3 avatar options (Ghost, Snake, Alien)</li>
              <li>✓ Edit your posts</li>
              <li>✓ Priority in Battles</li>
            </ul>
            <button
              className="btn-ghost w-full disabled:opacity-50 disabled:cursor-not-allowed"
              disabled={loading}
              onClick={() => handleSubscribe("plus")}
            >
              Get Plus
            </button>
          </div>

          <div className="card p-5 border-[#facc15]/30">
            <p className="font-bold text-lg mb-1 text-[#facc15]">👑 Prime — GHS 20/month</p>
            <ul className="text-sm text-white/70 space-y-1 mb-4 mt-2">
              <li>✓ Everything in Plus</li>
              <li>✓ All tier avatars unlocked</li>
              <li>✓ Real cash earnings from votes & battle wins</li>
              <li>✓ Request payouts (min GHS 20)</li>
              <li>✓ Early access to new features</li>
            </ul>
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