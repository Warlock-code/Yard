"use client"

import { useEffect, useState } from "react"
import { useRouter } from "next/navigation"
import { apiGet, apiPost } from "@/lib/useApi"
import { openPaystackCheckout } from "@/lib/purchaseGate"
import { TIER_CONFIG } from "@/lib/tier"
import { logPaywallHit } from "@/lib/logPaywall"

const ROWS: { label: string; free: string; plus: string; prime: string; primeWin: boolean }[] = [
  { label: "Price", free: "GHS 0", plus: "GHS 10/mo", prime: "GHS 20/mo", primeWin: false },
  { label: "Edit own posts", free: "—", plus: "✓", prime: "✓", primeWin: false },
  { label: "Avatar", free: "👻 default only", plus: "common only", prime: "common + rare free", primeWin: true },
  { label: "Badge", free: "—", plus: "✓ blue check", prime: "✓ gold prime", primeWin: true },
  { label: "Feed + battle priority", free: "normal", plus: "higher", prime: "highest", primeWin: true },
  { label: "Free post boost", free: "—", plus: "1 / week", prime: "2 / week", primeWin: true },
  { label: "Streak freeze", free: "—", plus: "1 / month", prime: "2 / month", primeWin: true },
  { label: "Credit rewards", free: "0 — missed counts here ↑", plus: "1x", prime: "2x", primeWin: true },
  { label: "Post hints (who's watching)", free: "counts", plus: "programs", prime: "programs + years", primeWin: true },
  { label: "Storage", free: "50 MB", plus: "50 + 50 MB", prime: "50 + 100 MB", primeWin: true },
  { label: "Theme", free: "default green", plus: "+ plus blue", prime: "+ gold", primeWin: true },
  { label: "Cash payouts", free: "—", plus: "—", prime: "—", primeWin: false },
  { label: "Shop (epic / legendary, boosts, freeze)", free: "buy separately", plus: "buy separately", prime: "buy separately", primeWin: false },
]

export default function UpgradePage() {
  const router = useRouter()
  const [me, setMe] = useState<{ tier: "FREE" | "PLUS" | "PRIME" } | null>(null)
  const [loading, setLoading] = useState<string | null>(null)
  const [missed, setMissed] = useState<{ total: number; weekly: number; plusWeekly: number; primeWeekly: number } | null>(null)

  useEffect(() => {
    logPaywallHit("upgrade_view", "/upgrade").catch(() => {})
  }, [])

  useEffect(() => {
    let active = true
    apiGet<{ user: { tier: "FREE" | "PLUS" | "PRIME" } | null }>("/api/auth/me")
      .then((data) => {
        if (active) setMe(data.user)
      })
      .catch(() => {})
    apiGet<{ total: number; weekly: number; plusWeekly: number; primeWeekly: number }>("/api/earnings/missed")
      .then((d) => { if (active) setMissed(d) })
      .catch(() => {})
    return () => { active = false }
  }, [])

  async function handleSubscribe(tier: "plus" | "prime" | "plus_annual" | "prime_annual") {
    if (!me || loading) return
    const base = tier.replace("_annual", "").toUpperCase()
    if (me.tier === base || (base === "PLUS" && me.tier === "PRIME")) return
    setLoading(tier)
    try {
      const data = await apiPost<{ data?: { authorization_url?: string } }>(`/api/subscribe/${tier}`, {})
      if (data.data?.authorization_url) await openPaystackCheckout(data.data.authorization_url)
    } catch (err: unknown) {
      alert(err instanceof Error ? err.message : "something went wrong.")
    } finally {
      setLoading(null)
    }
  }

  async function handleBundle(bundle: "plus" | "prime") {
    if (!me || loading) return
    setLoading(`bundle_${bundle}`)
    try {
      const data = await apiPost<{ authorization_url?: string; reference?: string }>(`/api/bundles`, { bundle })
      if (data.authorization_url) await openPaystackCheckout(data.authorization_url)
    } catch (err: unknown) {
      alert(err instanceof Error ? err.message : "something went wrong.")
    } finally {
      setLoading(null)
    }
  }

  const primeConfig = TIER_CONFIG.PRIME

  return (
    <main className="min-h-screen max-w-lg mx-auto pb-28 px-4">
      <div className="flex items-center gap-3 pt-5 pb-3">
        <button onClick={() => router.back()} className="text-white/60">←</button>
        <h1 className="text-xl font-bold">plus vs free</h1>
      </div>
      <p className="text-white/50 text-sm mb-4">every upgrade button lands here — compare, then decide. plus and prime renew monthly, cancel anytime.</p>

      {me?.tier === "FREE" && missed && missed.weekly > 0 && (
        <div className="card p-4 mb-4 border-[#baff39]/30 bg-[#baff39]/5">
          <p className="font-semibold text-sm">💸 you&apos;ve missed ~{missed.weekly}cr this week ({missed.total}cr total)</p>
          <p className="text-xs text-white/50 mt-1">
            as FREE you earn 0. PLUS would&apos;ve paid {missed.plusWeekly}cr · PRIME {missed.primeWeekly}cr for the same heat.
          </p>
        </div>
      )}

      {!me ? (
        <div className="space-y-4">
          <div className="card p-5 animate-pulse"><div className="h-4 w-32 bg-white/10 rounded mb-2" /><div className="h-3 w-full bg-white/5 rounded" /></div>
          <div className="card p-5 animate-pulse"><div className="h-4 w-32 bg-white/10 rounded mb-2" /><div className="h-3 w-full bg-white/5 rounded" /></div>
        </div>
      ) : me.tier === "PRIME" ? (
        <div className="card p-5 border-[#facc15]/30 bg-[#facc15]/5 relative overflow-hidden">
          <div className="absolute top-0 left-0 right-0 h-1 bg-gradient-to-r from-[#facc15] to-amber-500" />
          <div className="flex items-center gap-2 mb-3">
            <span className="text-2xl">👑</span>
            <p className="font-bold text-lg text-[#facc15]">prime active</p>
          </div>
          <p className="text-white/60 text-sm mb-4">you have everything — enjoy!</p>
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
              <p className="font-bold text-lg text-sky-300">plus active</p>
            </div>
            <p className="text-white/60 text-sm mb-4">nice. prime adds gold, 2x boosts and 2x credit rewards.</p>
          </div>
          <div className="card p-0 overflow-hidden border-[#facc15]/20">
            <div className="grid grid-cols-3 text-xs font-bold uppercase tracking-wide">
              <div className="p-3 text-white/40">perk</div>
              <div className="p-3 text-center text-sky-300 bg-sky-500/10">✨ plus</div>
              <div className="p-3 text-center text-[#facc15] bg-[#facc15]/10">👑 prime</div>
            </div>
            {ROWS.map((r) => (
              <div key={r.label} className="grid grid-cols-3 text-sm border-t border-white/5">
                <div className="p-3 text-white/70">{r.label}</div>
                <div className="p-3 text-center text-sky-200/70 bg-sky-500/[0.04]">{r.plus}</div>
                <div className={`p-3 text-center bg-[#facc15]/[0.04] ${r.primeWin ? "text-[#facc15] font-semibold" : "text-white/70"}`}>{r.prime}</div>
              </div>
            ))}
          </div>
          <button
            className="btn-primary w-full disabled:opacity-50 disabled:cursor-not-allowed"
            disabled={loading !== null}
            onClick={() => handleSubscribe("prime")}
          >
            {loading === "prime" ? "opening checkout..." : "go prime — ghs 20/month"}
          </button>
          <p className="text-center text-white/30 text-xs">pay with MoMo or card via paystack • auto-renew • cancel from this page</p>
        </div>
      ) : (
        <div className="space-y-4">
          <div className="card p-0 overflow-hidden border-white/10">
            <div className="grid grid-cols-4 text-xs font-bold uppercase tracking-wide">
              <div className="p-3 text-white/40">perk</div>
              <div className="p-3 text-center text-white/70 bg-white/5">👻 free</div>
              <div className="p-3 text-center text-sky-300 bg-sky-500/10">✨ plus</div>
              <div className="p-3 text-center text-[#facc15] bg-[#facc15]/10">👑 prime</div>
            </div>
            {ROWS.map((r) => (
              <div key={r.label} className="grid grid-cols-4 text-sm border-t border-white/5">
                <div className="p-3 text-white/70">{r.label}</div>
                <div className="p-3 text-center text-white/40 bg-white/[0.02]">{r.free}</div>
                <div className="p-3 text-center text-sky-200/80 bg-sky-500/[0.04]">{r.plus}</div>
                <div className={`p-3 text-center bg-[#facc15]/[0.04] ${r.primeWin ? "text-[#facc15] font-semibold" : "text-white/70"}`}>{r.prime}</div>
              </div>
            ))}
          </div>
          <button
            className="btn-primary w-full disabled:opacity-50 disabled:cursor-not-allowed"
            disabled={loading !== null}
            onClick={() => handleSubscribe("plus")}
          >
            {loading === "plus" ? "opening checkout..." : "upgrade to plus — ghs 10/month"}
          </button>
          <button
            className="w-full rounded-xl border border-[#facc15]/40 text-[#facc15] font-bold py-3 text-sm hover:bg-[#facc15]/10 disabled:opacity-50 disabled:cursor-not-allowed"
            disabled={loading !== null}
            onClick={() => handleSubscribe("prime")}
          >
            {loading === "prime" ? "opening checkout..." : "go prime — ghs 20/month"}
          </button>
          <p className="text-center text-white/30 text-xs">pay with MoMo or card via paystack • auto-renew • cancel from this page</p>
        </div>
      )}

      {me?.tier !== "PRIME" && (
        <div className="space-y-3 mt-4">
          <div className="card p-5">
            <p className="font-bold text-sm mb-1">💰 annual plans — cash upfront</p>
            <p className="text-xs text-white/40 mb-3">2 months free vs monthly. same perks, one payment.</p>
            <div className="grid grid-cols-2 gap-2">
              <button
                className="rounded-xl border border-sky-500/40 text-sky-300 font-bold py-2.5 text-xs hover:bg-sky-500/10 disabled:opacity-50"
                disabled={loading !== null || me?.tier !== "FREE"}
                onClick={() => handleSubscribe("plus_annual")}
              >
                {loading === "plus_annual" ? "…" : "plus yearly — ghs 100"}
              </button>
              <button
                className="rounded-xl border border-[#facc15]/40 text-[#facc15] font-bold py-2.5 text-xs hover:bg-[#facc15]/10 disabled:opacity-50"
                disabled={loading !== null}
                onClick={() => handleSubscribe("prime_annual")}
              >
                {loading === "prime_annual" ? "…" : "prime yearly — ghs 200"}
              </button>
            </div>
          </div>
          <div className="card p-5">
            <p className="font-bold text-sm mb-1">📦 bundles — tier + credits</p>
            <p className="text-xs text-white/40 mb-3">start stacked. one-time payment, credits land instantly.</p>
            <div className="grid grid-cols-2 gap-2">
              <button
                className="rounded-xl bg-sky-500/15 border border-sky-500/30 font-bold py-2.5 text-xs hover:bg-sky-500/25 disabled:opacity-50"
                disabled={loading !== null || me?.tier !== "FREE"}
                onClick={() => handleBundle("plus")}
              >
                {loading === "bundle_plus" ? "…" : "plus + 1,100cr — ghs 20"}
              </button>
              <button
                className="rounded-xl bg-[#facc15]/10 border border-[#facc15]/30 text-[#facc15] font-bold py-2.5 text-xs hover:bg-[#facc15]/20 disabled:opacity-50"
                disabled={loading !== null}
                onClick={() => handleBundle("prime")}
              >
                {loading === "bundle_prime" ? "…" : "prime + 2,400cr — ghs 40"}
              </button>
            </div>
          </div>
        </div>
      )}
    </main>
  )
}
