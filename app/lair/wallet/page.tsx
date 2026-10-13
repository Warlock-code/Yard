"use client"

import { useEffect, useState } from "react"
import { useRouter } from "next/navigation"
import Link from "next/link"
import { apiGet } from "@/lib/useApi"

type Txn = {
  id: string
  type: string
  amount: number
  balanceAfter: number
  createdAt: string
}

const TYPE_LABEL: Record<string, string> = {
  PURCHASE: "💳 pack bought",
  VOTE_REWARD: "🔥 vote reward",
  BATTLE_WIN: "⚔️ battle win",
  BATTLE_ENTRY: "⚔️ battle entry",
  BATTLE_ENTRY_FREE: "⚔️ free entry",
  DUEL_ENTRY: "⚔️ duel entry",
  LEADERBOARD: "🏆 leaderboard",
  REFERRAL: "🎁 referral",
  REFERRAL_BOOST: "🎁 referral boost",
  TIP_SENT: "💸 tip sent",
  TIP_RECEIVED: "💸 tip received",
  TIP_CROWN: "🏆 top tipper",
  BOOST_PURCHASE: "🚀 boost",
  PIN_PURCHASE: "📌 pin",
  CUSTOM_NAME: "👻 ghost name",
  COSMETIC_BUY: "🎨 avatar",
  THEME_BUY: "🎨 theme",
  STORAGE_PURCHASE: "💾 storage",
  STREAK_FREEZE: "🧊 streak freeze",
  STREAK_RESTORE: "🧊 streak restore",
  STREAK: "🔥 streak reward",
  STREAK_MULT: "🔥 streak multiplier",
  WHEEL_SPIN: "🎡 wheel spin",
  WHEEL_WIN: "🎡 wheel win",
  MYSTERY_BOX: "📦 mystery box",
  MYSTERY_WIN: "📦 mystery win",
  CAMPUS_WAR: "⚔️ war fund",
  XCAMPUS_POST: "🌍 cross-campus",
  VOICE_POST: "🎙️ voice post",
  POLL_CREATE: "📊 poll",
  REPLY: "💬 reply",
  MENTION: "📣 mention",
  REACTION_UNLOCK: "😂 reaction unlock",
  REACTION_USE: "😂 reaction",
  NAME_REVEAL: "🕵️ name reveal",
  NAME_PASS: "🕵️ reveal pass",
  COTD_WIN: "🏆 confession of the day",
  WINBACK: "🎁 welcome back",
  SCHED_PACK: "🗓️ schedule pack",
  ADMIN_MINT: "🛠️ admin grant",
  ADMIN_BURN: "🛠️ admin adjustment",
  ADMIN_REFUND: "💸 credit refund",
}

export default function WalletPage() {
  const router = useRouter()
  const [balance, setBalance] = useState<number | null>(null)
  const [earned, setEarned] = useState(0)
  const [purchased, setPurchased] = useState(0)
  const [txns, setTxns] = useState<Txn[]>([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    Promise.all([
      apiGet<{ balance: number; earned: number; purchased: number }>("/api/credits/balance"),
      apiGet<{ transactions: Txn[] }>("/api/credits/transactions?limit=50"),
    ])
      .then(([b, t]) => {
        setBalance(b.balance)
        setEarned(b.earned)
        setPurchased(b.purchased)
        // MISSED_* shadow rows are display-only upgrade nudges — never shown in the wallet.
        setTxns((t.transactions || []).filter((txn) => !txn.type.includes("MISSED")))
      })
      .catch(() => {})
      .finally(() => setLoading(false))
  }, [])

  return (
    <main className="min-h-screen max-w-lg mx-auto pb-28 px-4 bg-[#050505] text-white">
      <div className="flex items-center gap-3 pt-5 pb-3">
        <button onClick={() => router.back()} className="text-white/60">←</button>
        <h1 className="text-xl font-bold">wallet</h1>
      </div>
      <p className="text-white/40 text-xs mb-4">credits are in-app only — no cash value, never withdrawable.</p>

      {loading ? (
        <p className="text-center text-white/40 mt-10">loading wallet…</p>
      ) : (
        <>
          <div className="grid grid-cols-3 gap-2 mb-4">
            <div className="card p-3 text-center">
              <p className="text-[11px] text-white/40 uppercase">balance</p>
              <p className="text-xl font-black text-[#baff39]">{(balance ?? 0).toLocaleString()}</p>
            </div>
            <div className="card p-3 text-center">
              <p className="text-[11px] text-white/40 uppercase">earned</p>
              <p className="text-xl font-black">{earned.toLocaleString()}</p>
            </div>
            <div className="card p-3 text-center">
              <p className="text-[11px] text-white/40 uppercase">bought</p>
              <p className="text-xl font-black">{purchased.toLocaleString()}</p>
            </div>
          </div>

          <Link href="/shop?need=credits" className="btn-primary w-full block text-center mb-4">
            top up in the shop →
          </Link>

          <p className="text-xs font-bold text-white/50 mb-2">all transactions</p>
          <div className="space-y-2">
            {txns.length === 0 && (
              <div className="card p-5 text-center">
                <p className="text-white/40 text-sm">no transactions yet — earn or buy credits to start.</p>
              </div>
            )}
            {txns.map((t) => (
              <div key={t.id} className="card p-3 flex items-center justify-between gap-3">
                <div className="min-w-0">
                  <p className="text-sm font-semibold truncate">{TYPE_LABEL[t.type] || t.type}</p>
                  <p className="text-[11px] text-white/30">{new Date(t.createdAt).toLocaleString()}</p>
                </div>
                <p className={`font-black shrink-0 ${t.amount >= 0 ? "text-[#baff39]" : "text-white/70"}`}>
                  {t.amount >= 0 ? `+${t.amount}` : t.amount}
                </p>
              </div>
            ))}
          </div>
        </>
      )}
    </main>
  )
}
