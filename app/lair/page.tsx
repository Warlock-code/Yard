"use client"

import { useCallback, useEffect, useState } from "react"
import { useRouter } from "next/navigation"
import Link from "next/link"
import { apiGet, apiPost } from "@/lib/useApi"
import OptimizedImage from "@/app/components/OptimizedImage"
import Avatar from "@/app/components/Avatar"

type Me = {
  ghostId: string
  avatarEmoji: string
  campus: string
  tier: string
  streakCount: number
  ghostCoins: number
  postCount: number
  followersCount: number
  followingCount: number
  totalEarnedPesewas: number
  availableBalancePesewas: number
  hasPendingPayout: boolean
  storageUsed: number
  storageLimit: number
  storageRemaining: number
}

type PendingUpload = { id: string; url: string; sizeBytes: number }

type Bank = { name: string; code: string }

function ghs(pesewas: number) {
  return `GHS ${(pesewas / 100).toFixed(2)}`
}

export default function LairPage() {
  const router = useRouter()
  const [me, setMe] = useState<Me | null>(null)
  const [loading, setLoading] = useState(true)
  const [showPayout, setShowPayout] = useState(false)
  const [showDeleteModal, setShowDeleteModal] = useState(false)
  const [deletePassword, setDeletePassword] = useState("")
  const [deleting, setDeleting] = useState(false)
  const [banks, setBanks] = useState<Bank[]>([])
  const [bankCode, setBankCode] = useState("")
  const [accountNumber, setAccountNumber] = useState("")
  const [accountName, setAccountName] = useState("")
  const [uploads, setUploads] = useState<PendingUpload[]>([])
  const [storageLoading, setStorageLoading] = useState(true)
  const [storageError, setStorageError] = useState("")
  const [discarding, setDiscarding] = useState<string | null>(null)

  const loadStorage = useCallback((isCurrent: () => boolean = () => true) => {
    return apiGet("/api/storage")
      .then((data) => {
        if (!isCurrent()) return
        setUploads(data.uploads)
        setStorageError("")
      })
      .catch((err: unknown) => {
        if (isCurrent()) setStorageError(err instanceof Error ? err.message : "Could not load pending images.")
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
        throw new Error(data.error || "Could not discard image.")
      }
      setUploads((current) => current.filter((item) => item.id !== upload.id))
      const data = await apiGet("/api/auth/me")
      if (!data.user) throw new Error("Could not refresh storage. Reload to try again.")
      setMe((current) => current ? {
        ...current,
        storageUsed: data.user.storageUsed,
        storageLimit: data.user.storageLimit,
        storageRemaining: data.user.storageRemaining,
      } : current)
    } catch (err: unknown) {
      setStorageError(err instanceof Error ? err.message : "Could not update storage.")
    } finally {
      setDiscarding(null)
    }
  }

  const load = useCallback((isCurrent: () => boolean = () => true) => {
    return apiGet("/api/auth/me")
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

  useEffect(() => {
    let active = true
    load(() => active)
    loadStorage(() => active)
    return () => { active = false }
  }, [load, loadStorage])

  async function openPayoutModal() {
    if (banks.length === 0) {
      try {
        const data = await apiGet("/api/banks")
        setBanks(data.banks || [])
      } catch {
        setBanks([])
      }
    }
    setShowPayout(true)
  }

  async function handlePayoutRequest() {
    if (!bankCode || !accountNumber.trim() || !accountName.trim()) {
      alert("Fill in all payout details.")
      return
    }
    try {
      await apiPost("/api/payout/request", { bankCode, accountNumber, accountName })
      alert("Payout requested — pending admin approval.")
      setShowPayout(false)
      load()
    } catch (err: unknown) {
      alert(err instanceof Error ? err.message : "Something went wrong.")
    }
  }

  async function handleLogout() {
    document.cookie = "yard_token=; Max-Age=0; path=/"
    router.push("/login")
  }

  async function handleDeleteAccount() {
    if (!deletePassword.trim()) {
      alert("Enter your password to confirm.")
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
        throw new Error(data.error || "Could not delete account.")
      }
      router.push("/signup")
    } catch (err: unknown) {
      alert(err instanceof Error ? err.message : "Something went wrong.")
    } finally {
      setDeleting(false)
      setShowDeleteModal(false)
      setDeletePassword("")
    }
  }

  if (loading || !me) return <p className="text-center text-white/40 mt-10">Entering the den...</p>

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
        <p className="text-xs text-white/30 uppercase tracking-widest mb-1">The Den</p>
        <h1 className="text-xl font-bold">{me.ghostId}</h1>
        <div className="flex items-center gap-2 mt-1">
          <span className="text-white/40 text-sm">{me.campus}</span>
          {me.tier === "PRIME" && <span className="badge badge-prime">Prime</span>}
          {me.tier === "PLUS" && <span className="badge badge-plus">✓ Plus</span>}
        </div>

        <div className="flex gap-5 mt-3 text-sm">
          <button onClick={() => router.push("/lair/activity")} className="text-center">
            <span className="font-bold block">{me.followingCount}</span>
            <span className="text-white/40 text-xs">Following</span>
          </button>
          <button onClick={() => router.push("/lair/activity")} className="text-center">
            <span className="font-bold block">{me.followersCount}</span>
            <span className="text-white/40 text-xs">Followers</span>
          </button>
        </div>
      </div>

      <div className="grid grid-cols-3 gap-2 mb-4">
        <div className="card p-3 text-center">
          <p className="text-lg font-bold">🔥 {me.streakCount}</p>
          <p className="text-xs text-white/40">Streak</p>
        </div>
        <div className="card p-3 text-center">
          <p className="text-lg font-bold">{me.postCount}</p>
          <p className="text-xs text-white/40">Posts</p>
        </div>
        <div className="card p-3 text-center">
          <p className="text-lg font-bold">{me.ghostCoins}</p>
          <p className="text-xs text-white/40">Coins</p>
        </div>
      </div>

      <button
        className="card w-full p-4 mb-3 flex items-center justify-between"
        onClick={() => router.push("/lair/activity")}
      >
        <span className="font-semibold text-sm">📜 My Posts & Liked Posts</span>
        <span className="text-white/40">→</span>
      </button>

      <button
        className="card w-full p-4 mb-3 flex items-center justify-between"
        onClick={() => router.push("/owned")}
      >
        <span className="font-semibold text-sm">🎭 Owned — Avatars & Themes</span>
        <span className="text-white/40">→</span>
      </button>

      <div className="card p-4 mb-3">
        <div className="flex items-center justify-between mb-2">
          <p className="font-semibold">Image storage</p>
          <Link href="/shop" className="text-sm text-primary">Get more storage</Link>
        </div>
        <p className="text-sm text-white/50">
          {me.storageUsed.toFixed(2)} MB used / {me.storageLimit.toFixed(2)} MB
        </p>
        <p className="text-xs text-white/40 mt-1">{me.storageRemaining.toFixed(2)} MB remaining</p>
        <p className="font-semibold text-sm mt-4 mb-1">Pending images</p>
        <p className="text-xs text-white/40 mb-3">Discard unposted images to reclaim storage.</p>
        {storageError && (
          <p className="text-xs text-white/50 mb-3" role="alert">
            {storageError}{" "}
            <button className="text-primary" disabled={!!discarding} onClick={() => { load(); loadStorage() }}>Refresh</button>
          </p>
        )}
        {storageLoading ? (
          <p className="text-xs text-white/40">Loading pending images...</p>
        ) : uploads.length === 0 ? (
          !storageError && <p className="text-xs text-white/40">No pending images.</p>
        ) : (
          <ul className="space-y-3">
            {uploads.map((upload) => (
              <li key={upload.id} className="flex items-center gap-3">
                <div className="relative w-16 h-16 flex-shrink-0">
                  <OptimizedImage
                    src={upload.url}
                    alt="Unposted upload"
                    fill
                    sizes="64px"
                    rounded
                    unoptimized
                  />
                </div>
                <span className="text-xs text-white/50 flex-1">{(upload.sizeBytes / (1024 * 1024)).toFixed(2)} MB</span>
                <button
                  className="btn-ghost text-xs disabled:opacity-40"
                  disabled={!!discarding}
                  onClick={() => discardUpload(upload)}
                >
                  {discarding === upload.id ? "Discarding..." : "Discard"}
                </button>
              </li>
            ))}
          </ul>
        )}
      </div>

      {me.tier === "FREE" && (
        <div className="card p-4 mb-3">
          <p className="font-semibold mb-1">Deeper in the shadows</p>
          <p className="text-sm text-white/50 mb-3">Plus gets perks. Prime gets perks + real earnings.</p>
          <button className="btn-primary w-full" onClick={() => router.push("/upgrade")}>
            See plans
          </button>
        </div>
      )}

      {me.tier === "PLUS" && (
        <div className="card p-4 mb-3">
          <p className="font-semibold mb-1">Go all the way</p>
          <p className="text-sm text-white/50 mb-3">Unlock real earnings from your posts and battles.</p>
          <button className="btn-primary w-full" onClick={() => router.push("/upgrade")}>
            See Prime
          </button>
        </div>
      )}

      {me.tier === "PRIME" && (
        <div className="card p-4 mb-3">
          <p className="font-semibold mb-2">💰 The Vault</p>
          <div className="flex justify-between text-sm mb-1">
            <span className="text-white/50">Total earned</span>
            <span>{ghs(me.totalEarnedPesewas)}</span>
          </div>
          <div className="flex justify-between text-sm mb-3">
            <span className="text-white/50">Available balance</span>
            <span className="font-semibold">{ghs(me.availableBalancePesewas)}</span>
          </div>
          {me.hasPendingPayout ? (
            <p className="text-xs text-white/40 text-center">Payout request pending admin approval.</p>
          ) : (
            <>
              <button
                className="btn-primary w-full"
                onClick={openPayoutModal}
                disabled={me.availableBalancePesewas < 2000}
              >
                {me.availableBalancePesewas < 2000 ? "Min GHS 20.00 to withdraw" : "Request Payout"}
              </button>
              <p className="text-xs text-white/30 text-center mt-2">
                Payout requests only open at month-end and the 14th–16th of each month.
              </p>
            </>
          )}
        </div>
      )}

      <button className="btn-ghost w-full mt-2" onClick={handleLogout}>
        Log out
      </button>

      <button className="btn-ghost w-full mt-2 text-red-400" onClick={() => setShowDeleteModal(true)}>
        Delete Account
      </button>

      {showPayout && (
        <div className="fixed inset-0 bg-black/70 flex items-center justify-center z-50 px-4">
          <div className="card p-5 w-full max-w-sm bg-black">
            <h3 className="font-bold text-lg mb-1">Request Payout</h3>
            <p className="text-white/50 text-xs mb-3">Minimum GHS 20.00. Only opens at month-end and the 14th–16th.</p>
            <select className="input mb-2" value={bankCode} onChange={(e) => setBankCode(e.target.value)}>
              <option value="">Select your bank or MoMo network</option>
              {banks.map((b) => (
                <option key={b.code} value={b.code}>{b.name}</option>
              ))}
            </select>
            <input className="input mb-2" placeholder="Account number" value={accountNumber} onChange={(e) => setAccountNumber(e.target.value)} />
            <input className="input mb-3" placeholder="Account name" value={accountName} onChange={(e) => setAccountName(e.target.value)} />
            <div className="flex gap-2">
              <button className="btn-ghost flex-1" onClick={() => setShowPayout(false)}>Cancel</button>
              <button className="btn-primary flex-1" onClick={handlePayoutRequest}>Submit</button>
            </div>
          </div>
        </div>
      )}

      {showDeleteModal && (
        <div className="fixed inset-0 bg-black/70 flex items-center justify-center z-50 px-4">
          <div className="card p-5 w-full max-w-sm bg-black">
            <h3 className="font-bold text-lg mb-1">Delete Account</h3>
            <p className="text-white/50 text-sm mb-4">This action is irreversible. All your posts, votes, earnings, and data will be permanently deleted.</p>
            <input className="input mb-3" type="password" placeholder="Password to confirm" value={deletePassword} onChange={(e) => setDeletePassword(e.target.value)} />
            <div className="flex gap-2">
              <button className="btn-ghost flex-1" onClick={() => { setShowDeleteModal(false); setDeletePassword("") }}>Cancel</button>
              <button className="btn-primary flex-1" onClick={handleDeleteAccount} disabled={deleting}>
                {deleting ? "Deleting..." : "Delete Account"}
              </button>
            </div>
          </div>
        </div>
      )}
    </main>
  )
}