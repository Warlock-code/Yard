"use client"

import { useCallback, useEffect, useState } from "react"
import { useRouter } from "next/navigation"

type Stats = {
  userCount: number
  postCount: number
  primeCount: number
  plusCount: number
  revenuePesewas: number
  pendingPayoutPesewas: number
  paidOutPesewas: number
  activeUsers: number
}

type Report = {
  id: string
  reason: string
  aiVerdict: string | null
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

type AdminUser = { id: string; ghostId: string; email: string; campus: string; tier: string }
type AdminPost = { id: string; text: string | null; user: { ghostId: string } }

const SECTIONS = ["Overview", "Reports", "Payouts", "Users", "Posts", "Battles"]

function ghs(pesewas: number) {
  return `GHS ${(pesewas / 100).toFixed(2)}`
}

async function adminFetch(url: string, opts: RequestInit = {}) {
  const res = await fetch(url, { ...opts, credentials: "include" })
  const text = await res.text()
  const data = text ? JSON.parse(text) : {}
  if (!res.ok) throw new Error(data.error || "Request failed.")
  return data
}

export default function AdminPage() {
  const router = useRouter()
  const [section, setSection] = useState("Overview")
  const [notAllowed, setNotAllowed] = useState(false)
  const [loading, setLoading] = useState(true)

  const [stats, setStats] = useState<Stats | null>(null)
  const [reports, setReports] = useState<Report[]>([])
  const [payouts, setPayouts] = useState<Payout[]>([])
  const [users, setUsers] = useState<AdminUser[]>([])
  const [posts, setPosts] = useState<AdminPost[]>([])
  const [userSearch, setUserSearch] = useState("")
  const [postSearch, setPostSearch] = useState("")

  const [promptText, setPromptText] = useState("")
  const [campus, setCampus] = useState("")

  const loadAll = useCallback((isCurrent: () => boolean = () => true) => {
    return Promise.all([
      adminFetch("/api/admin/stats"),
      adminFetch("/api/admin/reports"),
      adminFetch("/api/admin/payouts"),
    ])
      .then(([s, r, p]) => {
        if (!isCurrent()) return
        setStats(s)
        setReports(r.reports)
        setPayouts(p.payouts)
      })
      .catch((err: unknown) => {
        if (isCurrent() && err instanceof Error && err.message === "Not authorized.") setNotAllowed(true)
      })
      .finally(() => {
        if (isCurrent()) setLoading(false)
      })
  }, [])

  useEffect(() => {
    let active = true
    loadAll(() => active)
    return () => { active = false }
  }, [loadAll])

  useEffect(() => {
    if (notAllowed) router.push("/admin/login")
  }, [notAllowed, router])

  useEffect(() => {
    if (section === "Users") {
      adminFetch(`/api/admin/users?search=${userSearch}`).then((d) => setUsers(d.users)).catch(() => {})
    }
    if (section === "Posts") {
      adminFetch(`/api/admin/posts?search=${postSearch}`).then((d) => setPosts(d.posts)).catch(() => {})
    }
  }, [section, userSearch, postSearch])

  async function handleReportAction(id: string, decision: "actioned" | "dismissed") {
    await adminFetch(`/api/admin/reports/${id}/action`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ decision }),
    })
    loadAll()
  }

  async function handleApprovePayout(id: string) {
    await adminFetch(`/api/admin/payouts/${id}/approve`, { method: "POST" })
    alert("Payout processed.")
    loadAll()
  }

  async function handleCreateBattle() {
    if (!promptText.trim() || !campus.trim()) return
    await adminFetch("/api/admin/battles/create", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ text: promptText, campus, durationHours: 24 }),
    })
    alert("Battle created.")
    setPromptText("")
    setCampus("")
  }

  async function handleDeleteUser(id: string) {
    if (!confirm("Delete this user permanently?")) return
    await adminFetch(`/api/admin/users/${id}`, { method: "DELETE" })
    setUsers((prev) => prev.filter((u) => u.id !== id))
  }

  async function handleDeletePost(id: string) {
    if (!confirm("Delete this post?")) return
    await adminFetch(`/api/admin/posts/${id}`, { method: "DELETE" })
    setPosts((prev) => prev.filter((p) => p.id !== id))
  }

  if (notAllowed) return null
  if (loading) return <p className="text-center text-white/40 mt-10">Loading admin...</p>

  return (
    <main className="min-h-screen max-w-lg mx-auto pb-10 px-4">
      <h1 className="text-2xl font-black mt-5 mb-3">🛠 Control Center</h1>

      <div className="flex gap-2 overflow-x-auto pb-3">
        {SECTIONS.map((s) => (
          <button
            key={s}
            onClick={() => setSection(s)}
            className={`whitespace-nowrap text-xs px-4 py-2 rounded-full border ${
              section === s ? "border-[#baff39] text-[#baff39]" : "border-white/10 text-white/40"
            }`}
          >
            {s}
          </button>
        ))}
      </div>

      {section === "Overview" && stats && (
        <div className="grid grid-cols-2 gap-2">
          <div className="card p-3"><p className="text-xs text-white/40">Users</p><p className="text-lg font-bold">{stats.userCount}</p></div>
          <div className="card p-3"><p className="text-xs text-white/40">Active (7d)</p><p className="text-lg font-bold">{stats.activeUsers}</p></div>
          <div className="card p-3"><p className="text-xs text-white/40">Posts</p><p className="text-lg font-bold">{stats.postCount}</p></div>
          <div className="card p-3"><p className="text-xs text-white/40">Prime</p><p className="text-lg font-bold">{stats.primeCount}</p></div>
          <div className="card p-3"><p className="text-xs text-white/40">Plus</p><p className="text-lg font-bold">{stats.plusCount}</p></div>
          <div className="card p-3 col-span-2"><p className="text-xs text-white/40">Total revenue</p><p className="text-lg font-bold">{ghs(stats.revenuePesewas)}</p></div>
          <div className="card p-3"><p className="text-xs text-white/40">Pending payouts</p><p className="text-lg font-bold">{ghs(stats.pendingPayoutPesewas)}</p></div>
          <div className="card p-3"><p className="text-xs text-white/40">Paid out</p><p className="text-lg font-bold">{ghs(stats.paidOutPesewas)}</p></div>
        </div>
      )}

      {section === "Reports" && (
        <div className="space-y-3">
          {reports.length === 0 ? <p className="text-white/30 text-sm">No open reports.</p> : reports.map((r) => (
            <div key={r.id} className="card p-4">
              <p className="text-sm text-white/50 mb-1">Reported by {r.reporter.ghostId}</p>
              <p className="text-sm mb-2">Reason: {r.reason}</p>
              {r.aiVerdict && <span className={`badge ${r.aiVerdict === "VIOLATION" ? "badge-prime" : "badge-boosted"}`}>AI: {r.aiVerdict}</span>}
              <p className="text-white/80 text-sm mt-2 mb-3">{r.post?.text || "(no text / image post)"}</p>
              <div className="flex gap-2">
                <button className="btn-ghost flex-1" onClick={() => handleReportAction(r.id, "dismissed")}>Dismiss</button>
                <button className="btn-primary flex-1" onClick={() => handleReportAction(r.id, "actioned")}>Remove</button>
              </div>
            </div>
          ))}
        </div>
      )}

      {section === "Payouts" && (
        <div className="space-y-3">
          {payouts.length === 0 ? <p className="text-white/30 text-sm">No pending payouts.</p> : payouts.map((p) => (
            <div key={p.id} className="card p-4">
              <p className="text-sm font-semibold">{p.user.ghostId}</p>
              <p className="text-xs text-white/40 mb-2">{p.user.email}</p>
              <p className="text-sm mb-1">Amount: {ghs(p.amount)}</p>
              <p className="text-xs text-white/50 mb-3">{p.accountName} · {p.accountNumber} · {p.bankCode}</p>
              <button className="btn-primary w-full" onClick={() => handleApprovePayout(p.id)}>Approve & Pay</button>
            </div>
          ))}
        </div>
      )}

      {section === "Users" && (
        <div>
          <input className="input mb-3" placeholder="Search ghost name..." value={userSearch} onChange={(e) => setUserSearch(e.target.value)} />
          <div className="space-y-2">
            {users.map((u) => (
              <div key={u.id} className="card p-3 flex items-center justify-between">
                <div>
                  <p className="text-sm font-semibold">{u.ghostId} {u.tier !== "FREE" && <span className="badge badge-prime">{u.tier}</span>}</p>
                  <p className="text-xs text-white/40">{u.email} · {u.campus}</p>
                </div>
                <button className="text-red-400 text-xs" onClick={() => handleDeleteUser(u.id)}>Ban</button>
              </div>
            ))}
          </div>
        </div>
      )}

      {section === "Posts" && (
        <div>
          <input className="input mb-3" placeholder="Search post text..." value={postSearch} onChange={(e) => setPostSearch(e.target.value)} />
          <div className="space-y-2">
            {posts.map((p) => (
              <div key={p.id} className="card p-3 flex items-center justify-between gap-2">
                <div className="min-w-0">
                  <p className="text-xs text-white/40">{p.user.ghostId}</p>
                  <p className="text-sm truncate">{p.text}</p>
                </div>
                <button className="text-red-400 text-xs flex-shrink-0" onClick={() => handleDeletePost(p.id)}>Delete</button>
              </div>
            ))}
          </div>
        </div>
      )}

      {section === "Battles" && (
        <div className="card p-4">
          <p className="font-semibold mb-2">Create Battle Prompt</p>
          <input className="input mb-2" placeholder="Prompt text" value={promptText} onChange={(e) => setPromptText(e.target.value)} />
          <input className="input mb-2" placeholder="Campus (exact match)" value={campus} onChange={(e) => setCampus(e.target.value)} />
          <button className="btn-primary w-full" onClick={handleCreateBattle}>Create</button>
        </div>
      )}
    </main>
  )
}