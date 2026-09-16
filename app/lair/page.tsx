"use client"

import { useEffect, useState } from "react"
import { useRouter } from "next/navigation"
import { apiGet, apiPost } from "@/lib/useApi"

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
}

type Bank = { name: string; code: string }

function ghs(pesewas: number) {
  return `GHS ${(pesewas / 100).toFixed(2)}`
}

export default function LairPage() {
  const router = useRouter()
  const [me, setMe] = useState<Me | null>(null)
  const [loading, setLoading] = useState(true)
  const [showPayout, setShowPayout] = useState(false)
  const [banks, setBanks] = useState<Bank[]>([])
  const [bankCode, setBankCode] = useState("")
  const [accountNumber, setAccountNumber] = useState("")
  const [accountName, setAccountName] = useState("")

  async function load() {
    try {
      const data = await apiGet("/api/auth/me")
      if (!data.user) {
        router.push("/login")
        return
      }
      setMe(data.user)
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    load()
  }, [])

  async function openPayoutModal() {
    try {
      const data = await apiGet("/api/banks")
      setBanks(data.banks || [])
    } catch {
      setBanks([])
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
    } catch (err: any) {
      alert(err.message)
    }
  }

  async function handleLogout() {
    document.cookie = "yard_token=; Max-Age=0; path=/"
    router.push("/login")
  }

  if (loading || !me) return <p className="text-center text-white/40 mt-10">Entering the den...</p>

  return (
    <main className="min-h-screen max-w-lg mx-auto pb-28 px-4 relative overflow-hidden">
      <div
        className="absolute top-0 left-1/2 -translate-x-1/2 w-72 h-72 rounded-full opacity-20 blur-3xl pointer-events-none"
        style={{ background: "radial-gradient(circle, #baff39, transparent 70%)" }}
      />

      <div className="flex flex-col items-center mt-8 mb-4 relative">
        <div
          className="avatar-circle text-4xl w-24 h-24 mb-3"
          style={{ boxShadow: "0 0 40px rgba(186,255,57,0.2)" }}
        >
          {me.avatarEmoji}
        </div>
        <p className="text-xs text-white/30 uppercase tracking-widest mb-1">The Den</p>
        <h1 className="text-xl font-bold">{me.ghostId}</h1>
        <div className="flex items-center gap-2 mt-1">
          <span className="text-white/40 text-sm">{me.campus}</span>
          {me.tier !== "FREE" && <span className="badge badge-prime">{me.tier}</span>}
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

      {showPayout && (
        <div className="fixed inset-0 bg-black/70 flex items-center justify-center z-50 px-4">
          <div className="card p-5 w-full max-w-sm bg-black">
            <h3 className="font-bold text-lg mb-1">Request Payout</h3>
            <p className="text-white/50 text-xs mb-3">Minimum GHS 20.00. Only opens at month-end and the 14th–16th.</p>
            <select className="input mb-2" value={bankCode} onChange={(e) => setBankCode(e.target.value)}>
              <option value="">Select mobile money network</option>
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
    </main>
  )
}