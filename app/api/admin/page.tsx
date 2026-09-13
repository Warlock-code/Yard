"use client"

import { useEffect, useState } from "react"
import { apiGet, apiPost } from "@/lib/useApi"

type Report = {
  id: string
  reason: string
  aiVerdict: string | null
  status: string
  post: { id: string; text: string | null } | null
  reporter: { ghostId: string }
}

type Payout = {
  id: string
  amount: number
  accountName: string | null
  accountNumber: string | null
  bankCode: string | null
  user: { ghostId: string; email: string }
}

export default function AdminPage() {
  const [reports, setReports] = useState<Report[]>([])
  const [payouts, setPayouts] = useState<Payout[]>([])
  const [loading, setLoading] = useState(true)
  const [notAllowed, setNotAllowed] = useState(false)

  const [promptText, setPromptText] = useState("")
  const [campus, setCampus] = useState("")

  async function load() {
    try {
      const [reportsData, payoutsData] = await Promise.all([
        apiGet("/api/admin/reports"),
        apiGet("/api/admin/payouts"),
      ])
      setReports(reportsData.reports)
      setPayouts(payoutsData.payouts)
    } catch (err: any) {
      if (err.message === "Not authorized.") setNotAllowed(true)
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    load()
  }, [])

  async function handleAction(id: string, decision: "actioned" | "dismissed") {
    try {
      await apiPost(`/api/admin/reports/${id}/action`, { decision })
      load()
    } catch (err: any) {
      alert(err.message)
    }
  }

  async function handleApprovePayout(id: string) {
    try {
      await apiPost(`/api/admin/payouts/${id}/approve`, {})
      alert("Payout processed.")
      load()
    } catch (err: any) {
      alert(err.message)
    }
  }

  async function handleCreateBattle() {
    if (!promptText.trim() || !campus.trim()) return
    try {
      await apiPost("/api/admin/battles/create", { text: promptText, campus, durationHours: 24 })
      alert("Battle created.")
      setPromptText("")
      setCampus("")
    } catch (err: any) {
      alert(err.message)
    }
  }

  function ghs(pesewas: number) {
    return `GHS ${(pesewas / 100).toFixed(2)}`
  }

  if (notAllowed) return <p className="text-center text-white/40 mt-10">Not authorized.</p>
  if (loading) return <p className="text-center text-white/40 mt-10">Loading admin...</p>

  return (
    <main className="min-h-screen max-w-lg mx-auto pb-24 px-4">
      <h1 className="text-2xl font-black mt-4 mb-4">🛠 Admin</h1>

      <div className="card p-4 mb-4">
        <p className="font-semibold mb-2">Create Battle Prompt</p>
        <input
          className="input mb-2"
          placeholder="Prompt text"
          value={promptText}
          onChange={(e) => setPromptText(e.target.value)}
        />
        <input
          className="input mb-2"
          placeholder="Campus (exact match, e.g. GCTU)"
          value={campus}
          onChange={(e) => setCampus(e.target.value)}
        />
        <button className="btn-primary w-full" onClick={handleCreateBattle}>
          Create
        </button>
      </div>

      <h2 className="font-semibold mb-2">Pending Payouts ({payouts.length})</h2>
      {payouts.length === 0 ? (
        <p className="text-white/30 text-sm mb-4">No pending payouts.</p>
      ) : (
        <div className="space-y-3 mb-4">
          {payouts.map((p) => (
            <div key={p.id} className="card p-4">
              <p className="text-sm font-semibold">{p.user.ghostId}</p>
              <p className="text-xs text-white/40 mb-2">{p.user.email}</p>
              <p className="text-sm mb-1">Amount: {ghs(p.amount)}</p>
              <p className="text-xs text-white/50 mb-3">
                {p.accountName} · {p.accountNumber} · bank {p.bankCode}
              </p>
              <button className="btn-primary w-full" onClick={() => handleApprovePayout(p.id)}>
                Approve & Pay via Paystack
              </button>
            </div>
          ))}
        </div>
      )}

      <h2 className="font-semibold mb-2">Open Reports ({reports.length})</h2>
      {reports.length === 0 ? (
        <p className="text-white/30 text-sm">No open reports.</p>
      ) : (
        <div className="space-y-3">
          {reports.map((r) => (
            <div key={r.id} className="card p-4">
              <p className="text-sm text-white/50 mb-1">Reported by {r.reporter.ghostId}</p>
              <p className="text-sm mb-2">Reason: {r.reason}</p>
              {r.aiVerdict && (
                <span className={`badge ${r.aiVerdict === "VIOLATION" ? "badge-prime" : "badge-boosted"}`}>
                  AI: {r.aiVerdict}
                </span>
              )}
              <p className="text-white/80 text-sm mt-2 mb-3">{r.post?.text || "(no text / image post)"}</p>
              <div className="flex gap-2">
                <button className="btn-ghost flex-1" onClick={() => handleAction(r.id, "dismissed")}>
                  Dismiss
                </button>
                <button className="btn-primary flex-1" onClick={() => handleAction(r.id, "actioned")}>
                  Remove Post
                </button>
              </div>
            </div>
          ))}
        </div>
      )}
    </main>
  )
}