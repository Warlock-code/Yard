"use client"

import { useEffect, useMemo, useState, Suspense } from "react"
import { useRouter, useSearchParams } from "next/navigation"
import Link from "next/link"
import { apiGet, apiPost } from "@/lib/useApi"
import { CREDIT_CONFIG } from "@/lib/credit-config"

const TIP_AMOUNTS = [50, 100, 200, 500]

type Tx = {
  id: string
  type: string
  amount: number
  balanceAfter: number
  createdAt: string
  metadata?: { postId?: string } | null
}

function extractPostId(input: string): string {
  const trimmed = input.trim()
  if (!trimmed) return ""
  // Accept raw id or full /post/<id> url / link.
  const match = trimmed.match(/\/post\/([A-Za-z0-9_-]+)/)
  if (match?.[1]) return match[1]
  return trimmed
}

function TipsContent() {
  const router = useRouter()
  const searchParams = useSearchParams()
  const [balance, setBalance] = useState<number | null>(null)
  // Prefill from ?postId= without a set-state-in-effect cascade.
  const [postInput, setPostInput] = useState(() => searchParams.get("postId") ?? "")
  const [amount, setAmount] = useState(100)
  const [customAmount, setCustomAmount] = useState("")
  const [sending, setSending] = useState(false)
  const [history, setHistory] = useState<Tx[]>([])
  const [historyLoading, setHistoryLoading] = useState(true)

  useEffect(() => {
    apiGet<{ balance: number }>("/api/credits/balance")
      .then((d) => setBalance(d.balance))
      .catch(() => setBalance(null))
    apiGet<{ transactions: Tx[] }>("/api/credits/transactions?limit=50")
      .then((d) => {
        setHistory((d.transactions || []).filter((t) => t.type === "TIP_SENT" || t.type === "TIP_RECEIVED"))
      })
      .catch(() => setHistory([]))
      .finally(() => setHistoryLoading(false))
  }, [])

  const effectiveAmount = useMemo(() => {
    const custom = parseInt(customAmount, 10)
    if (customAmount.trim() !== "" && Number.isSafeInteger(custom) && custom > 0) return custom
    return amount
  }, [amount, customAmount])

  async function send() {
    const postId = extractPostId(postInput)
    if (!postId) {
      alert("paste a post link or id first.")
      return
    }
    if (!Number.isSafeInteger(effectiveAmount) || effectiveAmount < CREDIT_CONFIG.SPEND.TIP_MIN) {
      alert(`minimum tip is ${CREDIT_CONFIG.SPEND.TIP_MIN} credits.`)
      return
    }
    setSending(true)
    try {
      const data = await apiPost<{ message?: string; newBalance?: number; received?: number }>("/api/tips/send", {
        postId,
        amount: effectiveAmount,
      })
      if (typeof data.newBalance === "number") setBalance(data.newBalance)
      alert(data.message || "tipped!")
      setPostInput("")
      setCustomAmount("")
      // Refresh history (best-effort, never blocks).
      try {
        const d = await apiGet<{ transactions: Tx[] }>("/api/credits/transactions?limit=50")
        setHistory((d.transactions || []).filter((t) => t.type === "TIP_SENT" || t.type === "TIP_RECEIVED"))
      } catch {
        // ignore refresh failures
      }
    } catch (err: unknown) {
      alert(err instanceof Error ? err.message : "tip failed.")
    } finally {
      setSending(false)
    }
  }

  return (
    <main className="min-h-screen max-w-lg mx-auto pb-28 px-4">
      <div className="pt-5 pb-3">
        <h1 className="text-2xl font-black">tips 🎁</h1>
        <p className="text-white/40 text-sm">support ghosts you like — same tips as on posts.</p>
      </div>

      <div className="card p-4 mb-3 flex items-center justify-between">
        <span className="text-white/50 text-sm">your balance</span>
        <span className="text-lg font-bold text-primary">
          {balance === null ? "…" : `${balance.toLocaleString()} credits`}
        </span>
      </div>

      <div className="card p-4 mb-3">
        <p className="font-semibold text-sm mb-1">send a tip</p>
        <p className="text-white/40 text-xs mb-3">
          paste a post link or id, pick an amount, send. {CREDIT_CONFIG.FEE.TIP_PCT}% fee — author gets the rest.
          author needs plus to receive.
        </p>
        <label className="text-xs text-white/50 block mb-1" htmlFor="tip-post">
          post link or id
        </label>
        <input
          id="tip-post"
          className="input w-full mb-3"
          placeholder="e.g. /post/abc123 or abc123"
          value={postInput}
          onChange={(e) => setPostInput(e.target.value)}
        />
        <p className="text-xs text-white/50 mb-1">amount</p>
        <div className="grid grid-cols-4 gap-1.5 mb-2">
          {TIP_AMOUNTS.map((a) => (
            <button
              key={a}
              onClick={() => {
                setAmount(a)
                setCustomAmount("")
              }}
              className={`text-xs font-bold px-2 py-2 rounded-lg border transition-colors ${
                effectiveAmount === a && customAmount.trim() === ""
                  ? "bg-[#baff39] text-black border-[#baff39]"
                  : "border-white/10 text-white/60 hover:text-white"
              }`}
            >
              {a}
            </button>
          ))}
        </div>
        <input
          className="input w-full mb-3"
          inputMode="numeric"
          placeholder={`or custom (min ${CREDIT_CONFIG.SPEND.TIP_MIN})`}
          value={customAmount}
          onChange={(e) => setCustomAmount(e.target.value.replace(/[^0-9]/g, ""))}
        />
        <button className="btn-primary w-full disabled:opacity-50" disabled={sending} onClick={send}>
          {sending ? "sending…" : `send ${effectiveAmount.toLocaleString()} credits`}
        </button>
        <p className="text-[11px] text-white/30 mt-2">
          limits: {CREDIT_CONFIG.SPEND.TIP_MAX_PER_USER_DAILY}/person/day · {CREDIT_CONFIG.SPEND.TIP_MAX_DAILY} total/day
        </p>
      </div>

      <div className="card p-4 mb-3">
        <div className="flex items-center justify-between mb-2">
          <p className="font-semibold text-sm">recent tips</p>
          <Link href="/shop" className="text-xs text-primary">
            get credits →
          </Link>
        </div>
        {historyLoading ? (
          <p className="text-xs text-white/40">loading…</p>
        ) : history.length === 0 ? (
          <p className="text-xs text-white/40">no tips yet — tip a post you like.</p>
        ) : (
          <ul className="space-y-2">
            {history.slice(0, 20).map((t) => {
              const postId = t.metadata?.postId
              return (
                <li key={t.id} className="flex items-center gap-3 text-sm">
                  <span className="text-lg">{t.type === "TIP_SENT" ? "🎁" : "💰"}</span>
                  <div className="flex-1 min-w-0">
                    <p className="font-medium">
                      {t.type === "TIP_SENT" ? `sent ${Math.abs(t.amount).toLocaleString()}` : `got ${t.amount.toLocaleString()}`}
                      <span className="text-white/40 font-normal"> credits</span>
                    </p>
                    <p className="text-xs text-white/40">{new Date(t.createdAt).toLocaleString()}</p>
                  </div>
                  {postId ? (
                    <button className="text-xs text-primary shrink-0" onClick={() => router.push(`/post/${postId}`)}>
                      view post →
                    </button>
                  ) : null}
                </li>
              )
            })}
          </ul>
        )}
      </div>

      <div className="card p-4">
        <p className="font-semibold text-sm mb-1">how tipping works</p>
        <ul className="text-xs text-white/50 space-y-1 list-disc pl-4">
          <li>tips use credits — top up in the shop.</li>
          <li>you can&apos;t tip yourself.</li>
          <li>authors need plus to receive tips.</li>
        </ul>
      </div>
    </main>
  )
}

export default function TipsPage() {
  return (
    <Suspense fallback={<main className="min-h-screen max-w-lg mx-auto pb-28 px-4"><p className="text-center text-white/40 mt-10">loading tips…</p></main>}>
      <TipsContent />
    </Suspense>
  )
}
