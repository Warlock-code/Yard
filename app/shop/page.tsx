"use client"

import { useEffect, useState } from "react"
import { useRouter } from "next/navigation"
import { apiGet, apiPost } from "@/lib/useApi"
import { openPaystackCheckout } from "@/lib/purchaseGate"
import { AVATARS, getAvatarPriceForTier, getRarityColor, isAvatarBuyable, isAvatarUnlockedForTier } from "@/lib/avatars"
import { THEMES, isThemeBuyable, isThemeUnlocked, type ThemeId } from "@/lib/themes"
import { getAllPacks } from "@/lib/credits"
import type { CreditPack } from "@/lib/credit-config"

const CATEGORIES = [
  { key: "credits", label: "credits", icon: "💳" },
  { key: "luck", label: "luck", icon: "🎡" },
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
  buyingId,
  onBuy,
}: {
  tier: "FREE" | "PLUS" | "PRIME"
  ownedCosmetics: string[]
  buyingId: string | null
  onBuy: (value: ThemeId) => void
}) {
  // Anything you already have — bought or included with your tier — lives
  // in owned, never in the shop. Only locked themes show here: paid ones
  // you can buy, tier ones as an upsell.
  const visibleThemes = THEMES.filter((theme) => {
    if (isThemeUnlocked(theme.id, tier, ownedCosmetics)) return false
    if (!isThemeBuyable(theme)) return false
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
        owned themes live in owned — only what you don&apos;t have shows here.
      </p>
      <div className="grid grid-cols-2 gap-3">
        {visibleThemes.map((theme) => {
          const isPaid = theme.pricePesewas > 0
          const isBuying = buyingId === theme.id

          return (
            <div key={theme.id} className="card p-4 text-center">
              <div
                className="mx-auto mb-2 h-12 w-12 rounded-full border border-white/10"
                style={{ background: `linear-gradient(135deg, ${theme.swatchFrom} 50%, ${theme.swatchTo} 50%)` }}
              />
              <p className="font-semibold text-sm">{theme.name}</p>
              <p className="text-xs mb-3 text-white/40">
                {isPaid ? theme.description : `${theme.requiresTier === "PRIME" ? "prime" : "plus"} perk`}
              </p>
              {isPaid ? (
                <button
                  className="w-full text-sm btn-primary disabled:opacity-50 disabled:cursor-not-allowed"
                  disabled={buyingId !== null}
                  onClick={() => onBuy(theme.id)}
                >
                  {isBuying ? "..." : `buy — ${theme.pricePesewas / 100} credits`}
                </button>
              ) : (
                <button className="w-full text-sm btn-ghost opacity-50 cursor-not-allowed" disabled>
                  🔒 {theme.requiresTier === "PRIME" ? "prime" : "plus"} only
                </button>
              )}
            </div>
          )
        })}
      </div>
    </div>
  )
}

type WheelStatus = { freeAvailable: boolean; spinCost: number; bundleCost: number }

function LuckSection({ onBought }: { onBought: () => void }) {
  const [status, setStatus] = useState<WheelStatus | null>(null)
  const [busy, setBusy] = useState<string | null>(null)
  const [result, setResult] = useState<string | null>(null)

  useEffect(() => {
    apiGet<WheelStatus>("/api/wheel")
      .then((d) => setStatus({ freeAvailable: d.freeAvailable, spinCost: d.spinCost, bundleCost: d.bundleCost }))
      .catch(() => {})
  }, [])

  async function spin(kind: "free" | "paid" | "bundle10") {
    setBusy(kind)
    setResult(null)
    try {
      const d = await apiPost<{ spins: { reward: number; bonusCredits?: number }[]; total: number }>(
        "/api/wheel",
        { kind }
      )
      const bonus = d.spins.reduce((sum, s) => sum + (s.bonusCredits ?? 0), 0)
      setResult(`+${d.total}cr${bonus > 0 ? ` (incl. 🎁 +${bonus}cr bonus)` : ""}`)
      onBought()
      apiGet<WheelStatus>("/api/wheel")
        .then((s) => setStatus({ freeAvailable: s.freeAvailable, spinCost: s.spinCost, bundleCost: s.bundleCost }))
        .catch(() => {})
    } catch (err: unknown) {
      // Needs-credits already redirected to /shop by the api client.
      if (err instanceof Error && !err.message.startsWith("NEEDS_CREDITS:")) {
        setResult(err.message)
      }
    } finally {
      setBusy(null)
    }
  }

  async function openBox() {
    setBusy("box")
    setResult(null)
    try {
      const d = await apiPost<{ reward: number; bonusCredits?: number; total?: number }>("/api/mystery-box", {})
      const total = typeof d.total === "number" ? d.total : d.reward + (d.bonusCredits ?? 0)
      setResult(`+${total}cr${d.bonusCredits ? ` (incl. 🎁 +${d.bonusCredits}cr bonus)` : ""}`)
      onBought()
    } catch (err: unknown) {
      if (err instanceof Error && !err.message.startsWith("NEEDS_CREDITS:")) {
        setResult(err.message)
      }
    } finally {
      setBusy(null)
    }
  }

  return (
    <div className="space-y-3 mt-2">
      <div className="card p-5 text-center">
        <p className="text-3xl mb-1">🎡</p>
        <p className="font-bold">haunt wheel</p>
        <p className="text-white/40 text-xs mb-3">free spin daily (5–50cr) · paid {status?.spinCost ?? 100}cr (20–1000cr + rare bonus credits)</p>
        <div className="grid grid-cols-3 gap-2">
          <button className="btn-primary text-sm disabled:opacity-50" disabled={busy !== null || !status?.freeAvailable} onClick={() => spin("free")}>
            {busy === "free" ? "…" : status?.freeAvailable === false ? "used ✓" : "free spin"}
          </button>
          <button className="btn-ghost text-sm disabled:opacity-50" disabled={busy !== null} onClick={() => spin("paid")}>
            {busy === "paid" ? "…" : `${status?.spinCost ?? 100}cr`}
          </button>
          <button className="btn-ghost text-sm disabled:opacity-50" disabled={busy !== null} onClick={() => spin("bundle10")}>
            {busy === "bundle10" ? "…" : `10x · ${status?.bundleCost ?? 950}cr`}
          </button>
        </div>
      </div>
      <div className="card p-5 text-center">
        <p className="text-3xl mb-1">📦</p>
        <p className="font-bold">mystery box</p>
        <p className="text-white/40 text-xs mb-3">100cr · random 10–410cr + rare bonus credits (50–150cr)</p>
        <button className="btn-primary w-full text-sm disabled:opacity-50" disabled={busy !== null} onClick={openBox}>
          {busy === "box" ? "opening…" : "open — 100cr"}
        </button>
      </div>
      {result && (
        <div className="card p-4 text-center border-[#baff39]/30 bg-[#baff39]/5">
          <p className="font-bold text-sm">{result}</p>
        </div>
      )}
    </div>
  )
}

export default function ShopPage() {
  const router = useRouter()
  const [category, setCategory] = useState("credits")
  const [needBanner, setNeedBanner] = useState(false)
  const [loading, setLoading] = useState<string | null>(null)
  const [me, setMe] = useState<{ tier: "FREE" | "PLUS" | "PRIME"; ownedCosmetics: string[]; freeBoosts: number; creditsBalance: number } | null>(null)
  const [levelInfo, setLevelInfo] = useState<{ myLevel: number; items: { id: string; levelUnlock: number | null; levelUnlocked: boolean }[] } | null>(null)
  useEffect(() => {
    // Landed here from an insufficient-credits redirect? Say why.
    try {
      if (typeof window !== "undefined" && new URLSearchParams(window.location.search).get("need") === "credits") {
        setNeedBanner(true)
      }
    } catch {}
    apiGet<{ user: { tier: "FREE" | "PLUS"; ownedCosmetics: string[]; freeBoosts?: number } | null }>("/api/auth/me").then((d) => {
      if (d.user) {
        const u = d.user
        setMe((prev) => ({ tier: u.tier, ownedCosmetics: u.ownedCosmetics, freeBoosts: u.freeBoosts ?? prev?.freeBoosts ?? 0, creditsBalance: prev?.creditsBalance ?? 0 }))
      }
    }).catch(() => {})
    apiGet<{ balance: number }>("/api/credits/balance").then((d) => setMe(prev => prev ? { ...prev, creditsBalance: d.balance } : null)).catch(() => {})
    apiGet<{ myLevel: number; items: { id: string; levelUnlock: number | null; levelUnlocked: boolean }[] }>("/api/shop/cosmetic").then((d) => setLevelInfo({ myLevel: d.myLevel, items: d.items })).catch(() => {})
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
      const data = await apiPost<{
        authorization_url?: string
        message?: string
        amountCharged?: number
        pack?: { credits?: number; ghs?: number }
      }>("/api/credits/purchase", { packId })
      const url = data.authorization_url as string | undefined
      if (url) {
        // Server-authoritative amount: confirm the EXACT Paystack charge
        // (same pesewas value sent to Paystack) before opening checkout.
        const pesewas = typeof data.amountCharged === "number" ? data.amountCharged : (data.pack?.ghs ?? 0) * 100
        const ghs = pesewas / 100
        const ghsLabel = `GHS ${ghs % 1 === 0 ? ghs : ghs.toFixed(2)}`
        const creditsLabel = data.pack?.credits ? `${data.pack.credits.toLocaleString()} credits` : "your pack"
        const ok = window.confirm(
          `charge ${ghsLabel} for ${creditsLabel}? paystack will open with this exact amount.`
        )
        if (!ok) return
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

      {needBanner && (
        <div className="card p-4 mb-3 border-[#baff39]/30 bg-[#baff39]/5">
          <p className="font-semibold text-sm">💳 not enough credits for that</p>
          <p className="text-white/50 text-xs mt-1">top up below — credits land instantly and work everywhere in the app.</p>
        </div>
      )}

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
            {getAllPacks().map((pack: CreditPack) => {
              return (
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
              )
            })}
          </div>
        </div>
      )}

      {category === "luck" && (
        <LuckSection
          onBought={() => {
            apiGet<{ balance: number }>("/api/credits/balance")
              .then((d) => setMe((prev) => (prev ? { ...prev, creditsBalance: d.balance } : prev)))
              .catch(() => {})
          }}
        />
      )}

      {category === "tier" && !me && (
        <div className="card p-5 mt-2 animate-pulse"><div className="h-4 w-24 bg-white/10 rounded mb-2" /><div className="h-3 w-full bg-white/5 rounded" /></div>
      )}
      {category === "tier" && me?.tier === "PRIME" && (
        <div className="card p-5 mt-2 border-[#facc15]/30 bg-[#facc15]/5 relative overflow-hidden">
          <div className="absolute top-0 left-0 right-0 h-1 bg-gradient-to-r from-[#facc15] to-amber-500" />
          <p className="text-xs text-[#facc15] uppercase mb-1 font-bold">👑 prime</p>
          <p className="font-semibold text-sm text-white/70">you&apos;re on the highest plan — no further upgrade.</p>
        </div>
      )}
      {category === "tier" && me?.tier === "PLUS" && (
        <div className="space-y-3 mt-2">
          <div className="card p-5 relative overflow-hidden border-[#facc15]/25">
            <div className="absolute top-0 left-0 right-0 h-1 bg-gradient-to-r from-[#facc15] to-transparent" />
            <p className="text-xs text-[#facc15] uppercase mb-1">prime — ghs 20</p>
            <p className="font-bold text-lg mb-2">gold, 2x boosts and 2x credit rewards</p>
            <p className="text-white/50 text-sm mb-3">compare plans, then checkout.</p>
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
          <div className="card p-5 relative overflow-hidden border-[#facc15]/25">
            <div className="absolute top-0 left-0 right-0 h-1 bg-gradient-to-r from-[#facc15] to-transparent" />
            <p className="text-xs text-[#facc15] uppercase mb-1">prime — ghs 20</p>
            <p className="font-bold text-lg mb-2">gold, 2x boosts and 2x credit rewards</p>
            <p className="text-white/50 text-sm mb-3">for creators who want it all.</p>
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
        // Anything you already have — bought or included with your tier —
        // lives in owned, never in the shop. API still guards both cases.
        const visibleAvatars = AVATARS.filter(
          (c) => isAvatarBuyable(c) && !(me?.ownedCosmetics?.includes(c.id) || (me && isAvatarUnlockedForTier(me.tier, c.id)))
        )
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
            <p className="text-white/40 text-xs mb-3 px-1">avatars you have live in owned — only what you don&apos;t have shows here.</p>
            <div className="grid grid-cols-2 sm:grid-cols-3 gap-3 mt-2">
              {visibleAvatars.map((c) => {
                const price = me ? getAvatarPriceForTier(me.tier, c) : c.pricePesewas
                const rarityClass = getRarityColor(c.rarity)
                const lvl = levelInfo?.items.find((i) => i.id === c.id)
                const claimable = !!lvl?.levelUnlocked
                const lockedLevel = !claimable ? lvl?.levelUnlock ?? null : null
                return (
                  <div key={c.id} className="card p-4 text-center">
                    <p className="text-3xl mb-2">{c.emoji}</p>
                    <p className="font-semibold text-sm">{c.name}</p>
                    <p className={`text-xs uppercase ${rarityClass}`}>{c.rarity}</p>
                    <p className="text-xs mb-3 text-white/40">
                      {claimable ? "🔓 free at your level" : lockedLevel ? `🔓 unlocked at level ${lockedLevel}` : `${price / 100} credits`}
                    </p>
                    {claimable ? (
                      <button
                        className="w-full text-sm btn-primary"
                        disabled={loading === c.id}
                        onClick={async () => {
                          await buyWithCredits("/api/shop/cosmetic", c.id, { cosmeticId: c.id, useCredits: true })
                          apiGet<{ myLevel: number; items: { id: string; levelUnlock: number | null; levelUnlocked: boolean }[] }>("/api/shop/cosmetic").then((d) => setLevelInfo({ myLevel: d.myLevel, items: d.items })).catch(() => {})
                        }}
                      >
                        {loading === c.id ? "..." : "claim free 🎁"}
                      </button>
                    ) : (
                      <button
                        className="w-full text-sm btn-primary disabled:opacity-50"
                        disabled={loading === c.id || lockedLevel !== null}
                        onClick={() => buyWithCredits("/api/shop/cosmetic", c.id, { cosmeticId: c.id, useCredits: true })}
                      >
                        {loading === c.id ? "..." : `buy — ${price / 100} credits`}
                      </button>
                    )}
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
          buyingId={loading}
          onBuy={(themeId) => buyWithCredits("/api/shop/theme", themeId, { themeId, useCredits: true })}
        />
      )}
    </main>
  )
}