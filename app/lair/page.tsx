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
  const [showDeleteModal, setShowDeleteModal] = useState(false)
  const [deletePassword, setDeletePassword] = useState("")
  const [deleting, setDeleting] = useState(false)
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

  async function handleDeleteAccount() {
    if (!deletePassword.trim()) {
      alert("enter your password to confirm.")
      return
    }
    setDeleting(true)
    try {
      const res = await fetch("/api/auth/delete-account", {
        method: "DELETE",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify({ password: deletePassword }),
      })
      if (!res.ok) {
        const data = await res.json()
        throw new Error(data.error || "could not delete account.")
      }
      router.push("/signup")
    } catch (err: unknown) {
      alert(err instanceof Error ? err.message : "something went wrong.")
    } finally {
      setDeleting(false)
      setShowDeleteModal(false)
      setDeletePassword("")
    }
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
          <ChampionTrophies trophies={me.championTrophies} />
        </div>

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
        <div className="card p-4 mb-4">
          <div className="flex items-center justify-between mb-3">
            <p className="font-semibold">👥 referrals</p>
            <span className="text-xs text-white/40">{referralStats.stats.verifiedReferrals}/{referralStats.stats.totalReferrals} verified</span>
          </div>

          <div className="grid grid-cols-3 gap-2 mb-3">
            <div className="card p-3 text-center bg-white/[0.03]">
              <p className="text-lg font-bold text-primary">{referralStats.stats.totalReferrals}</p>
              <p className="text-xs text-white/40">total</p>
            </div>
            <div className="card p-3 text-center bg-white/[0.03]">
              <p className="text-lg font-bold text-primary">{referralStats.stats.verifiedReferrals}</p>
              <p className="text-xs text-white/40">verified</p>
            </div>
            <div className="card p-3 text-center bg-white/[0.03]">
              <p className="text-lg font-bold text-primary">{referralStats.stats.creditsEarned}</p>
              <p className="text-xs text-white/40">credits earned</p>
            </div>
          </div>

          <div className="mb-3">
            <p className="text-xs text-white/50 mb-1">your referral link</p>
            <div className="flex gap-2">
              <input
                className="input flex-1 text-sm"
                readOnly
                value={referralStats.referralLink}
              />
              <button
                className="btn-primary px-4"
                onClick={async () => {
                  await navigator.clipboard.writeText(referralStats.referralLink)
                  setCopied(true)
                  setTimeout(() => setCopied(false), 1500)
                }}
              >
                {copied ? "✓ copied" : "copy"}
              </button>
            </div>
            <p className="text-xs text-white/40 mt-1">
              share: <code className="text-primary">{referralStats.code}</code> → {referralStats.stats.referrerReward} credits for you, {referralStats.stats.refereeReward} for them on verification
            </p>
          </div>

          {referralStats.referrals.length > 0 && (
            <details className="group">
              <summary className="flex items-center justify-between cursor-pointer select-none">
                <span className="text-sm font-medium">recent referrals</span>
                <span className="text-xs text-white/40">{referralStats.referrals.length} total</span>
              </summary>
              <ul className="space-y-2 mt-3 pt-3 border-t border-white/10">
                {referralStats.referrals.slice(0, 10).map((r) => (
                  <li key={r.id} className="flex items-center gap-3 text-sm">
                    <Avatar emoji={r.avatarEmoji} size={28} />
                    <div className="flex-1 min-w-0">
                      <p className="font-medium truncate">{r.ghostId}</p>
                      <p className="text-xs text-white/40">
                        {new Date(r.joinedAt).toLocaleDateString()} •
                        {r.emailVerified ? " ✓ verified" : " pending verification"}
                      </p>
                    </div>
                    <span className={`badge badge-xs ${
                      r.rewardStatus === "completed" ? "badge-primary" :
                      r.rewardStatus === "flagged" ? "badge-warning" :
                      r.status === "pending" ? "badge-ghost" : "badge-ghost"
                    }`}>
                      {r.rewardStatus === "completed" ? `+${r.rewardAmount} 🔥` :
                       r.rewardStatus === "flagged" ? "⚠ flagged" :
                       r.status === "pending" ? "pending" : "no reward"}
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

      <div className="card p-4 mb-3">
        <div className="flex items-center justify-between mb-2">
          <p className="font-semibold">image storage</p>
          <Link href="/shop" className="text-sm text-primary">get more storage</Link>
        </div>
        <p className="text-sm text-white/50">
          {me.storageUsed.toFixed(2)} mb used / {me.storageLimit.toFixed(2)} mb
        </p>
        <p className="text-xs text-white/40 mt-1">{me.storageRemaining.toFixed(2)} mb remaining</p>
        <p className="font-semibold text-sm mt-4 mb-1">pending images</p>
        <p className="text-xs text-white/40 mb-3">discard unposted images to reclaim storage.</p>
        {storageError && (
          <p className="text-xs text-white/50 mb-3" role="alert">
            {storageError}{" "}
            <button className="text-primary" disabled={!!discarding} onClick={() => { load(); loadStorage() }}>refresh</button>
          </p>
        )}
        {storageLoading ? (
          <p className="text-xs text-white/40">loading pending images...</p>
        ) : uploads.length === 0 ? (
          !storageError && <p className="text-xs text-white/40">no pending images.</p>
        ) : (
          <ul className="space-y-3">
            {uploads.map((upload) => (
              <li key={upload.id} className="flex items-center gap-3">
                <div className="relative w-16 h-16 flex-shrink-0">
                  <OptimizedImage
                    src={upload.url}
                    alt="unposted upload"
                    fill
                    sizes="64px"
                    rounded
                    unoptimized
                  />
                </div>
                <span className="text-xs text-white/50 flex-1">{(upload.sizeBytes / (1024 * 1024)).toFixed(2)} mb</span>
                <button
                  className="btn-ghost text-xs disabled:opacity-40"
                  disabled={!!discarding}
                  onClick={() => discardUpload(upload)}
                >
                  {discarding === upload.id ? "discarding..." : "discard"}
                </button>
              </li>
            ))}
          </ul>
        )}
      </div>

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

      <button className="btn-ghost w-full mt-2 text-red-400" onClick={() => setShowDeleteModal(true)}>
        delete account
      </button>

      {showDeleteModal && (
        <div className="fixed inset-0 bg-black/70 flex items-center justify-center z-50 px-4">
          <div className="card p-5 w-full max-w-sm bg-black">
            <h3 className="font-bold text-lg mb-1">delete account</h3>
            <p className="text-white/50 text-sm mb-4">this action is irreversible. all your posts, votes, and data will be permanently deleted.</p>
            <input className="input mb-3" type="password" placeholder="password to confirm" value={deletePassword} onChange={(e) => setDeletePassword(e.target.value)} />
            <div className="flex gap-2">
              <button className="btn-ghost flex-1" onClick={() => { setShowDeleteModal(false); setDeletePassword("") }}>cancel</button>
              <button className="btn-primary flex-1" onClick={handleDeleteAccount} disabled={deleting}>
                {deleting ? "deleting..." : "delete account"}
              </button>
            </div>
          </div>
        </div>
      )}

    </main>
  )
}