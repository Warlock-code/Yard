"use client"

import { useCallback, useEffect, useState } from "react"
import { useRouter } from "next/navigation"
import Link from "next/link"
import { apiGet, apiPost } from "@/lib/useApi"
import OptimizedImage from "@/app/components/OptimizedImage"
import Avatar from "@/app/components/Avatar"
import ChampionTrophies from "@/app/components/ChampionTrophies"
import { logPaywallHit } from "@/lib/logPaywall"

type Me = {
  ghostId: string
  avatarEmoji: string
  campus: string
  cohortYear: number | null
  tier: string
  championTrophies?: number
  streakCount: number
  ghostCoins: number
  creditsBalance: number
  postCount: number
  followersCount: number
  followingCount: number
  storageUsed: number
  storageLimit: number
  storageRemaining: number
  inviteCode: string
  referralCount: number
}

type PendingUpload = { id: string; url: string; sizeBytes: number }

type ReferralStats = {
  code: string
  referralLink: string
  stats: {
    totalReferrals: number
    verifiedReferrals: number
    flaggedReferrals: number
    pendingReferrals: number
    creditsEarned: number
    dailyCap: number
    referrerReward: number
    refereeReward: number
  }
  referrals: Array<{
    id: string
    ghostId: string
    avatarEmoji: string
    joinedAt: string
    emailVerified: boolean
    status: string
    rewardStatus: string
    rewardAmount: number
    completedAt: string | null
  }>
}

export default function LairPage() {
  const router = useRouter()
  const [me, setMe] = useState<Me | null>(null)
  const [loading, setLoading] = useState(true)
  const [uploads, setUploads] = useState<PendingUpload[]>([])
  const [storageLoading, setStorageLoading] = useState(true)
  const [storageError, setStorageError] = useState("")
  const [discarding, setDiscarding] = useState<string | null>(null)
  const [referralStats, setReferralStats] = useState<{
    code: string
    referralLink: string
    stats: {
      totalReferrals: number
      verifiedReferrals: number
      flaggedReferrals: number
      pendingReferrals: number
      creditsEarned: number
      dailyCap: number
      referrerReward: number
      refereeReward: number
    }
    referrals: Array<{
      id: string
      ghostId: string
      avatarEmoji: string
      joinedAt: string
      emailVerified: boolean
      status: string
      rewardStatus: string
      rewardAmount: number
      completedAt: string | null
    }>
  } | null>(null)
  const [copied, setCopied] = useState(false)
  const [newName, setNewName] = useState("")
  const [renaming, setRenaming] = useState(false)
  const loadStorage = useCallback((isCurrent: () => boolean = () => true) => {
    return apiGet<{ uploads: PendingUpload[] }>("/api/storage")
      .then((data) => {
        if (!isCurrent()) return
        setUploads(data.uploads)
        setStorageError("")
      })
      .catch((err: unknown) => {
        if (isCurrent()) setStorageError(err instanceof Error ? err.message : "could not load pending images.")
      })
      .finally(() => {
        if (isCurrent()) setStorageLoading(false)
      })
  }, [])

  async function discardUpload(upload: PendingUpload) {
    if (discarding) return
    setDiscarding(upload.id)
    setStorageError("")
    try {
      const res = await fetch("/api/storage", {
        method: "DELETE",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify({ url: upload.url }),
      })
      if (!res.ok) {
        const data = await res.json()
        throw new Error(data.error || "could not discard image.")
      }
      setUploads((current) => current.filter((item) => item.id !== upload.id))
      const data = await apiGet<{ user: Pick<Me, "storageUsed" | "storageLimit" | "storageRemaining"> | null }>("/api/auth/me")
      const refreshed = data.user
      if (!refreshed) throw new Error("could not refresh storage. reload to try again.")
      setMe((current) => current ? {
        ...current,
        storageUsed: refreshed.storageUsed,
        storageLimit: refreshed.storageLimit,
        storageRemaining: refreshed.storageRemaining,
      } : current)
    } catch (err: unknown) {
      setStorageError(err instanceof Error ? err.message : "could not update storage.")
    } finally {
      setDiscarding(null)
    }
  }

  const load = useCallback((isCurrent: () => boolean = () => true) => {
    return apiGet<{ user: Me | null }>("/api/auth/me")
      .then((data) => {
        if (!isCurrent()) return
        if (!data.user) {
          router.push("/login")
          return
        }
        setMe(data.user)
      })
      .catch(console.error)
      .finally(() => {
        if (isCurrent()) setLoading(false)
      })
  }, [router])

  const loadReferral = useCallback((isCurrent: () => boolean = () => true) => {
    return apiGet<ReferralStats>("/api/referral/stats")
      .then((data) => {
        if (!isCurrent()) return
        setReferralStats(data)
      })
      .catch(console.error)
  }, [])

  useEffect(() => {
    let active = true
    load(() => active)
    loadStorage(() => active)
    loadReferral(() => active)
    return () => { active = false }
  }, [load, loadStorage, loadReferral])

  async function handleLogout() {
    document.cookie = "yard_token=; Max-Age=0; path=/"
    router.push("/login")
  }

  async function handleRename() {
    const name = newName.trim()
    if (!name) {
      alert("enter a new ghost name.")
      return
    }
    if (renaming) return
    setRenaming(true)
    try {
      const data = await apiPost<{ ghostId: string; newBalance?: number; message?: string }>("/api/shop/custom-name", { newName: name, useCredits: true })
      setMe((current) => current ? { ...current, ghostId: data.ghostId, creditsBalance: typeof data.newBalance === "number" ? data.newBalance : current.creditsBalance } : current)
      setNewName("")
      alert(data.message || "ghost name changed!")
    } catch (err: unknown) {
      alert(err instanceof Error ? err.message : "something went wrong.")
    } finally {
      setRenaming(false)
    }
  }

  if (loading || !me) return <p className="text-center text-white/40 mt-10">entering the den...</p>

  return (
    <main className="min-h-screen max-w-lg mx-auto pb-28 px-4 relative overflow-hidden">
      <div
        className="absolute top-0 left-1/2 -translate-x-1/2 w-72 h-72 rounded-full opacity-20 blur-3xl pointer-events-none"
        style={{ background: "radial-gradient(circle, #baff39, transparent 70%)" }}
      />

      <div className="flex flex-col items-center mt-8 mb-4 relative">
        <div className="relative w-24 h-24 mb-3" style={{ boxShadow: "0 0 40px rgba(186,255,57,0.2)" }}>
          <Avatar emoji={me.avatarEmoji} size={96} />
        </div>
        <p className="text-xs text-white/30 uppercase tracking-widest mb-1">the den</p>
        <h1 className="text-xl font-bold">{me.ghostId}</h1>
        <div className="flex items-center gap-2 mt-1">
          <span className="text-white/40 text-sm">{me.campus}</span>
          {me.tier === "PLUS" && <span className="badge badge-plus">✓ plus</span>}
          {me.tier === "PRIME" && <span className="badge badge-prime">👑 prime</span>}
          <ChampionTrophies trophies={me.championTrophies} />
        </div>
        <button
          onClick={() => router.push("/settings")}
          className="mt-1.5 text-xs text-white/40 hover:text-white/70 flex items-center gap-1"
          aria-label="open settings to edit admission year"
        >
          {me.cohortYear != null ? `class of ${me.cohortYear}` : "set your admission year"} <span aria-hidden="true">⚙️</span>
        </button>

        <div className="flex gap-5 mt-3 text-sm">
          <button onClick={() => router.push("/lair/activity")} className="text-center">
            <span className="font-bold block">{me.followingCount}</span>
            <span className="text-white/40 text-xs">following</span>
          </button>
          <button onClick={() => router.push("/lair/activity")} className="text-center">
            <span className="font-bold block">{me.followersCount}</span>
            <span className="text-white/40 text-xs">followers</span>
          </button>
        </div>
      </div>

      <div className="grid grid-cols-3 gap-2 mb-4">
        <div className="card p-3 text-center">
          <p className="text-lg font-bold">🔥 {me.streakCount}</p>
          <p className="text-xs text-white/40">streak</p>
        </div>
        <div className="card p-3 text-center">
          <p className="text-lg font-bold">{me.postCount}</p>
          <p className="text-xs text-white/40">posts</p>
        </div>
        <div className="card p-3 text-center">
          <p className="text-lg font-bold">{me.creditsBalance}</p>
          <p className="text-xs text-white/40">credits</p>
        </div>
      </div>

      {me.tier === "PRIME" ? (
        <div className="card p-4 mb-4 border-[#facc15]/25">
          <div className="flex items-center justify-between mb-2">
            <p className="font-semibold">🪙 credits</p>
            <span className="text-xs text-white/40">{me.creditsBalance} balance</span>
          </div>
          <p className="text-xs text-white/50 mb-3">earn credits from votes, tips and streaks — spend them on boosts, pins, avatars and themes in the shop. credits live in the app and can&apos;t be withdrawn for cash.</p>
          <button className="btn-primary w-full" onClick={() => router.push("/shop")}>
            spend in the shop →
          </button>
        </div>
      ) : (
        <button
          className="card w-full p-4 mb-4 flex items-center justify-between border-[#facc15]/20"
          onClick={() => router.push("/upgrade")}
        >
          <span className="font-semibold text-sm">👑 prime <span className="text-white/40 font-normal">gold + 2x boosts</span></span>
          <span className="text-xs font-bold text-[#facc15]">👑 prime →</span>
        </button>
      )}

      <div className="card p-4 mb-4">
        <p className="font-semibold">✏️ ghost name</p>
        <p className="text-sm text-white/50 mb-3">500 credits only.</p>
        <div className="flex gap-2">
          <input
            className="input flex-1"
            placeholder={me.ghostId}
            value={newName}
            onChange={(e) => setNewName(e.target.value)}
            onKeyDown={(e) => e.key === "Enter" && handleRename()}
            maxLength={24}
          />
          <button className="btn-primary px-4 disabled:opacity-50" disabled={renaming || !newName.trim()} onClick={handleRename}>
            {renaming ? "…" : "change"}
          </button>
        </div>
      </div>

      {referralStats && (
        <div className="card p-3 mb-3">
          <div className="flex items-center justify-between">
            <p className="font-semibold text-sm">👥 referrals</p>
            <span className="text-[11px] text-white/40">{referralStats.stats.verifiedReferrals}/{referralStats.stats.totalReferrals} verified • +{referralStats.stats.creditsEarned} credits</span>
          </div>
          <div className="flex gap-2 mt-2">
            <input
              className="input flex-1 h-8 text-xs"
              readOnly
              value={referralStats.referralLink}
              aria-label="referral link"
            />
            <button
              className="btn-primary px-3 h-8 text-xs shrink-0"
              onClick={async () => {
                await navigator.clipboard.writeText(referralStats.referralLink)
                setCopied(true)
                setTimeout(() => setCopied(false), 1500)
              }}
            >
              {copied ? "✓" : "copy"}
            </button>
          </div>
          {referralStats.stats.pendingReferrals > 0 && (
            <p className="text-[11px] text-primary mt-1.5">
              ⏳ {referralStats.stats.pendingReferrals} pending = {referralStats.stats.pendingReferrals * referralStats.stats.referrerReward} credits on the way
            </p>
          )}
          {referralStats.referrals.length > 0 && (
            <details className="mt-2 pt-2 border-t border-white/10">
              <summary className="text-xs text-white/50 cursor-pointer select-none">
                recent ({referralStats.referrals.length})
              </summary>
              <ul className="space-y-1.5 mt-2">
                {referralStats.referrals.slice(0, 5).map((r) => (
                  <li key={r.id} className="flex items-center gap-2 text-xs">
                    <Avatar emoji={r.avatarEmoji} size={22} />
                    <span className="flex-1 truncate">{r.ghostId}</span>
                    <span className="text-[10px] text-white/40">
                      {r.rewardStatus === "completed" ? `+${r.rewardAmount}` :
                        r.emailVerified ? "✓" : "pending"}
                    </span>
                  </li>
                ))}
              </ul>
            </details>
          )}
        </div>
      )}

      <button
        className="card w-full p-4 mb-3 flex items-center justify-between"
        onClick={() => router.push("/lair/activity")}
      >
        <span className="font-semibold text-sm">📜 my posts & liked posts</span>
        <span className="text-white/40">→</span>
      </button>

      <button
        className="card w-full p-4 mb-3 flex items-center justify-between"
        onClick={() => router.push("/owned")}
      >
        <span className="font-semibold text-sm">🎭 owned</span>
        <span className="text-white/40">→</span>
      </button>

      <button
        className="card w-full p-4 mb-3 flex items-center justify-between"
        onClick={() => router.push("/analytics")}
      >
        <span className="font-semibold text-sm">📊 analytics</span>
        <span className="text-white/40">→</span>
      </button>

      <div className="card p-3 mb-3">
        <div className="flex items-center justify-between">
          <p className="font-semibold text-sm">🖼 storage</p>
          <Link href="/shop" className="text-[11px] text-primary">get more →</Link>
        </div>
        <p className="text-[11px] text-white/50 mt-1">
          {me.storageUsed.toFixed(2)} / {me.storageLimit.toFixed(2)} mb • {me.storageRemaining.toFixed(2)} left
        </p>
        <div className="h-1 rounded-full bg-white/10 mt-1.5 overflow-hidden">
          <div
            className="h-full bg-primary rounded-full"
            style={{ width: `${me.storageLimit > 0 ? Math.min(100, (me.storageUsed / me.storageLimit) * 100) : 0}%` }}
          />
        </div>
        {storageError && (
          <p className="text-[11px] text-white/50 mt-2" role="alert">
            {storageError}{" "}
            <button className="text-primary" disabled={!!discarding} onClick={() => { load(); loadStorage() }}>retry</button>
          </p>
        )}
        {storageLoading ? (
          <p className="text-[11px] text-white/40 mt-2">loading...</p>
        ) : uploads.length === 0 ? (
          !storageError && <p className="text-[11px] text-white/40 mt-2">no pending images.</p>
        ) : (
          <ul className="space-y-1.5 mt-2 pt-2 border-t border-white/10">
            {uploads.slice(0, 5).map((upload) => (
              <li key={upload.id} className="flex items-center gap-2">
                <div className="relative w-10 h-10 flex-shrink-0">
                  <OptimizedImage
                    src={upload.url}
                    alt="unposted upload"
                    fill
                    sizes="40px"
                    rounded
                    unoptimized
                  />
                </div>
                <span className="text-[11px] text-white/50 flex-1">{(upload.sizeBytes / (1024 * 1024)).toFixed(2)} mb</span>
                <button
                  className="text-[11px] text-white/40 hover:text-white/70 disabled:opacity-40"
                  disabled={!!discarding}
                  onClick={() => discardUpload(upload)}
                >
                  {discarding === upload.id ? "..." : "discard"}
                </button>
              </li>
            ))}
            {uploads.length > 5 && (
              <p className="text-[10px] text-white/30">+{uploads.length - 5} more</p>
            )}
          </ul>
        )}
      </div>

      {me.tier === "PLUS" && (
        <div className="card p-4 mb-3 border-[#facc15]/25">
          <p className="font-semibold mb-1">👑 go prime</p>
          <p className="text-sm text-white/50 mb-3">gold badge, 2x weekly boosts, 2x credit rewards, 2 freezes a month + full analytics.</p>
          <button className="w-full rounded-xl border border-[#facc15]/40 text-[#facc15] font-bold py-2.5 text-sm hover:bg-[#facc15]/10" onClick={() => { logPaywallHit("upgrade_view", "/lair").catch(()=>{}); router.push("/upgrade") }}>
            prime — ghs 20/mo
          </button>
        </div>
      )}
      {me.tier === "FREE" && (
        <div className="card p-4 mb-3">
          <p className="font-semibold mb-1">deeper in the shadows</p>
          <p className="text-sm text-white/50 mb-3">plus gets edits, avatars, blue checkmark & priority.</p>
          <button className="btn-primary w-full" onClick={() => { logPaywallHit("upgrade_view", "/lair").catch(()=>{}); router.push("/upgrade") }}>
            see plans
          </button>
        </div>
      )}

      <button className="btn-ghost w-full mt-2" onClick={handleLogout}>
        log out
      </button>

    </main>
  )
}