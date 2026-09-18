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

type SectionKey = "Overview" | "Reports" | "Payouts" | "Users" | "Posts" | "Battles"

const NAV_GROUPS: { label: string; items: { key: SectionKey; label: string; icon: string; desc: string }[] }[] = [
  { label: "Dashboard", items: [{ key: "Overview", label: "Overview", icon: "📊", desc: "Revenue & health" }] },
  { label: "Moderation", items: [{ key: "Reports", label: "Reports", icon: "🚨", desc: "Flagged posts" }] },
  { label: "Money", items: [{ key: "Payouts", label: "Payouts", icon: "💸", desc: "Creator payments" }] },
  { label: "Content", items: [
    { key: "Users", label: "Users", icon: "👥", desc: "Search & manage" },
    { key: "Posts", label: "Posts", icon: "📝", desc: "Search & delete" },
  ]},
  { label: "Engagement", items: [{ key: "Battles", label: "Battles", icon: "⚔️", desc: "Create prompts" }] },
]

const CAMPUSES = ["University of Ghana", "KNUST", "UCC", "GCTU", "UPSA"]

function ghs(pesewas: number) {
  return `GHS ${(pesewas / 100).toFixed(2)}`
}

async function adminFetch(url: string, opts: RequestInit = {}) {
  const res = await fetch(url, { ...opts, credentials: "include" })
  const text = await res.text()
  let data: any = {}
  try { data = text ? JSON.parse(text) : {} } catch { data = { error: text || "Request failed." } }
  if (!res.ok) throw new Error(data.error || `Request failed (${res.status})`)
  return data
}

function NavButton({ active, icon, label, count, onClick, desc }: { active: boolean; icon: string; label: string; count?: number | null; onClick: () => void; desc?: string }) {
  return (
    <button
      onClick={onClick}
      aria-current={active ? "page" : undefined}
      className={`w-full flex items-center gap-3 px-3 py-2.5 rounded-xl border text-left transition-all focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#baff39] ${
        active ? "bg-[#baff39]/10 border-[#baff39]/30 text-[#baff39]" : "border-transparent text-white/60 hover:bg-white/[0.04] hover:text-white/90 hover:border-white/10"
      }`}
    >
      <span className={`w-8 h-8 rounded-lg flex items-center justify-center text-sm flex-shrink-0 ${active ? "bg-[#baff39]/20" : "bg-white/[0.06]"}`} aria-hidden>{icon}</span>
      <span className="flex-1 min-w-0">
        <span className="block text-sm font-semibold leading-none">{label}</span>
        {desc && <span className={`block text-[11px] mt-1 ${active ? "text-[#baff39]/70" : "text-white/30"}`}>{desc}</span>}
      </span>
      {typeof count === "number" && count > 0 && (
        <span className={`text-[11px] font-bold px-2 py-1 rounded-full flex-shrink-0 ${active ? "bg-[#baff39] text-black" : "bg-white/10 text-white/70"}`}>{count > 99 ? "99+" : count}</span>
      )}
    </button>
  )
}

export default function AdminPage() {
  const router = useRouter()
  const [section, setSection] = useState<SectionKey>("Overview")
  const [mobileOpen, setMobileOpen] = useState(false)
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
  const [busyId, setBusyId] = useState<string | null>(null)

  const loadAll = useCallback((isCurrent: () => boolean = () => true) => {
    return Promise.all([
      adminFetch("/api/admin/stats"),
      adminFetch("/api/admin/reports"),
      adminFetch("/api/admin/payouts"),
    ])
      .then(([s, r, p]) => {
        if (!isCurrent()) return
        setStats(s)
        setReports(r.reports || [])
        setPayouts(p.payouts || [])
      })
      .catch((err: unknown) => {
        if (isCurrent() && err instanceof Error && (err.message.includes("Not authorized") || err.message.includes("403"))) setNotAllowed(true)
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

  // debounced search for users/posts
  useEffect(() => {
    if (section !== "Users") return
    const t = setTimeout(() => {
      adminFetch(`/api/admin/users?search=${encodeURIComponent(userSearch)}`).then((d) => setUsers(d.users || [])).catch(() => {})
    }, 300)
    return () => clearTimeout(t)
  }, [section, userSearch])

  useEffect(() => {
    if (section !== "Posts") return
    const t = setTimeout(() => {
      adminFetch(`/api/admin/posts?search=${encodeURIComponent(postSearch)}`).then((d) => setPosts(d.posts || [])).catch(() => {})
    }, 300)
    return () => clearTimeout(t)
  }, [section, postSearch])

  async function handleReportAction(id: string, decision: "actioned" | "dismissed") {
    if (busyId) return
    setBusyId(id)
    try {
      await adminFetch(`/api/admin/reports/${id}/action`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ decision }),
      })
      await loadAll()
    } catch (e: any) {
      alert(e.message || "Failed to update report")
    } finally { setBusyId(null) }
  }

  async function handleApprovePayout(id: string) {
    if (busyId) return
    if (!confirm("Approve this payout via Paystack? This will send real money.")) return
    setBusyId(id)
    try {
      await adminFetch(`/api/admin/payouts/${id}/approve`, { method: "POST" })
      alert("Payout approved and transfer initiated.")
      await loadAll()
    } catch (e: any) {
      alert(e.message || "Transfer failed. Check Paystack balance / keys and try again.")
    } finally { setBusyId(null) }
  }

  async function handleCreateBattle() {
    if (!promptText.trim() || !campus.trim()) {
      alert("Prompt and campus required")
      return
    }
    if (busyId) return
    setBusyId("battle")
    try {
      await adminFetch("/api/admin/battles/create", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ text: promptText, campus, durationHours: 24 * 7 }),
      })
      alert("Battle created.")
      setPromptText("")
      setCampus("")
    } catch (e: any) {
      alert(e.message || "Failed to create battle. Check campus & try again.")
    } finally { setBusyId(null) }
  }

  async function handleDeleteUser(id: string) {
    if (!confirm("Suspend / Ban this user? Cancel = hard delete (only for test accounts).")) {
      if (!confirm("Hard delete user permanently? This only works if user has no posts.")) return
      try {
        setBusyId(id)
        await adminFetch(`/api/admin/users/${id}`, { method: "DELETE" })
        setUsers((prev) => prev.filter((u) => u.id !== id))
      } catch (e: any) { alert(e.message || "Delete failed - user has posts. Try suspend/ban instead.") }
      finally { setBusyId(null) }
      return
    }
    const action = confirm("OK = BAN, Cancel = Suspend") ? "ban" : "suspend"
    try {
      setBusyId(id)
      await adminFetch(`/api/admin/users/${id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action }),
      })
      alert(`User ${action}ned.`)
      const q = userSearch
      adminFetch(`/api/admin/users?search=${encodeURIComponent(q)}`).then((d) => setUsers(d.users || [])).catch(() => {})
    } catch (e: any) { alert(e.message || "Action failed.") }
    finally { setBusyId(null) }
  }

  async function handleDeletePost(id: string) {
    if (!confirm("Delete this post?")) return
    try {
      setBusyId(id)
      await adminFetch(`/api/admin/posts/${id}`, { method: "DELETE" })
      setPosts((prev) => prev.filter((p) => p.id !== id))
      // refresh stats
      loadAll()
    } catch (e: any) { alert(e.message || "Delete failed.") }
    finally { setBusyId(null) }
  }

  function handleSectionChange(s: SectionKey) {
    setSection(s)
    setMobileOpen(false)
  }

  if (notAllowed) return null
  if (loading) return <p className="text-center text-white/40 mt-20">Loading admin…</p>

  return (
    <div className="min-h-screen bg-[#050505] flex">
      {/* Desktop sidebar */}
      <aside className="hidden md:flex w-[270px] shrink-0 sticky top-0 h-screen border-r border-white/[0.06] bg-[#080808] flex-col">
        <div className="px-5 py-6 border-b border-white/[0.06]">
          <div className="flex items-center gap-2">
            <span className="font-black text-xl tracking-tight">YARD<span className="text-[#baff39]">.</span></span>
            <span className="text-[10px] font-bold tracking-widest text-white/30 border border-white/10 rounded-full px-2 py-0.5">ADMIN</span>
          </div>
          <p className="text-xs text-white/30 mt-2">Control Center · Ghana campuses</p>
        </div>
        {/* Tier mini stats — makes sidebar feel used */}
        <div className="px-3 pt-3">
          {stats ? (
            <div className="card p-3 bg-white/[0.02] border-white/[0.06]">
              <p className="text-[10px] font-bold tracking-widest text-white/30 uppercase mb-2">Tier breakdown</p>
              <div className="space-y-2">
                {(() => {
                  const freeCount = Math.max(0, stats.userCount - stats.primeCount - stats.plusCount)
                  const total = Math.max(1, stats.userCount)
                  const items = [
                    { label: "Prime", icon: "👑", count: stats.primeCount, price: "GHS 20", color: "text-[#facc15]", bg: "bg-[#facc15]/15 border-[#facc15]/20", bar: "bg-[#facc15]" },
                    { label: "Plus", icon: "⭐", count: stats.plusCount, price: "GHS 10", color: "text-sky-300", bg: "bg-sky-500/10 border-sky-500/20", bar: "bg-sky-400" },
                    { label: "Free", icon: "👻", count: freeCount, price: "Free", color: "text-white/60", bg: "bg-white/5 border-white/10", bar: "bg-white/20" },
                  ]
                  return items.map((it) => {
                    const pct = Math.round((it.count / total) * 100)
                    return (
                      <div key={it.label} className="flex items-center gap-2.5">
                        <span className={`w-7 h-7 rounded-lg border flex items-center justify-center text-xs ${it.bg}`}>{it.icon}</span>
                        <div className="flex-1 min-w-0">
                          <div className="flex items-center justify-between">
                            <span className={`text-xs font-bold ${it.color}`}>{it.label}</span>
                            <span className="text-xs font-black">{it.count}</span>
                          </div>
                          <div className="flex items-center gap-1.5">
                            <div className="flex-1 h-1.5 rounded-full bg-white/5 overflow-hidden">
                              <div className={`h-full rounded-full ${it.bar}`} style={{ width: `${pct}%` }} />
                            </div>
                            <span className="text-[10px] text-white/25 font-medium">{pct}% · {it.price}</span>
                          </div>
                        </div>
                      </div>
                    )
                  })
                })()}
              </div>
              <div className="mt-2 pt-2 border-t border-white/5 flex items-center justify-between text-[11px]">
                <span className="text-white/30">{stats.userCount} total · {stats.activeUsers} active 7d</span>
                <span className="text-white/20 font-mono">{ghs(stats.revenuePesewas)}</span>
              </div>
            </div>
          ) : (
            <div className="card p-3 bg-white/[0.02] border-white/[0.06] animate-pulse">
              <div className="h-3 w-20 bg-white/10 rounded mb-3" />
              <div className="space-y-2">
                {[1,2,3].map(i=> <div key={i} className="h-8 bg-white/5 rounded" />)}
              </div>
            </div>
          )}
        </div>
        <div className="flex-1 overflow-y-auto p-3 space-y-6 no-scrollbar">
          {NAV_GROUPS.map((group) => (
            <div key={group.label}>
              <p className="text-[10px] font-bold tracking-[0.14em] text-white/25 uppercase mb-2 px-2">{group.label}</p>
              <div className="space-y-1">
                {group.items.map((it) => {
                  const count = it.key === "Reports" ? reports.length : it.key === "Payouts" ? payouts.length : undefined
                  return (
                    <NavButton
                      key={it.key}
                      active={section === it.key}
                      icon={it.icon}
                      label={it.label}
                      desc={it.desc}
                      count={count}
                      onClick={() => handleSectionChange(it.key)}
                    />
                  )
                })}
              </div>
            </div>
          ))}
        </div>
        <div className="p-3 border-t border-white/[0.06]">
          <button onClick={() => router.push("/feed")} className="btn-ghost w-full text-sm">← Back to Yard</button>
          <p className="text-[11px] text-white/20 text-center mt-2">Keys: reports & payouts handle real money</p>
        </div>
      </aside>

      {/* Mobile drawer backdrop */}
      {mobileOpen && (
        <div className="fixed inset-0 z-40 md:hidden">
          <div className="absolute inset-0 bg-black/60 backdrop-blur-sm" onClick={() => setMobileOpen(false)} />
          <div className="absolute left-0 top-0 bottom-0 w-[288px] bg-[#0a0a0a] border-r border-white/10 flex flex-col overflow-hidden">
            <div className="px-5 py-5 border-b border-white/10 flex items-center justify-between">
              <span className="font-black text-lg">YARD<span className="text-[#baff39]">.</span> <span className="text-[10px] tracking-widest text-white/30 ml-1">ADMIN</span></span>
              <button onClick={() => setMobileOpen(false)} className="w-8 h-8 rounded-full bg-white/5 grid place-items-center text-white/60">✕</button>
            </div>
            {stats && (
              <div className="px-3 pt-3">
                <div className="card p-3 bg-white/[0.02] border-white/10">
                  <p className="text-[10px] font-bold tracking-widest text-white/30 uppercase mb-2">Tiers</p>
                  <div className="space-y-2">
                    {(() => {
                      const freeCount = Math.max(0, stats.userCount - stats.primeCount - stats.plusCount)
                      return [
                        { label: "Prime", icon: "👑", count: stats.primeCount, color: "text-[#facc15]" },
                        { label: "Plus", icon: "⭐", count: stats.plusCount, color: "text-sky-300" },
                        { label: "Free", icon: "👻", count: freeCount, color: "text-white/60" },
                      ].map(it => (
                        <div key={it.label} className="flex items-center justify-between text-xs">
                          <span className={it.color}>{it.icon} {it.label}</span>
                          <span className="font-bold">{it.count}</span>
                        </div>
                      ))
                    })()}
                  </div>
                </div>
              </div>
            )}
            <div className="flex-1 overflow-y-auto p-3 space-y-6">
              {NAV_GROUPS.map((group) => (
                <div key={group.label}>
                  <p className="text-[10px] font-bold tracking-[0.14em] text-white/25 uppercase mb-2 px-2">{group.label}</p>
                  <div className="space-y-1">
                    {group.items.map((it) => {
                      const count = it.key === "Reports" ? reports.length : it.key === "Payouts" ? payouts.length : undefined
                      return <NavButton key={it.key} active={section === it.key} icon={it.icon} label={it.label} desc={it.desc} count={count} onClick={() => handleSectionChange(it.key)} />
                    })}
                  </div>
                </div>
              ))}
            </div>
            <div className="p-3 border-t border-white/10">
              <button onClick={() => router.push("/feed")} className="btn-ghost w-full text-sm">← Back to Yard</button>
            </div>
          </div>
        </div>
      )}

      {/* Main column */}
      <div className="flex-1 min-w-0 flex flex-col">
        {/* Mobile header */}
        <header className="md:hidden sticky top-0 z-30 bg-black/80 backdrop-blur border-b border-white/10 flex items-center gap-3 px-4 py-3">
          <button onClick={() => setMobileOpen(true)} aria-label="Open navigation" className="w-9 h-9 rounded-xl bg-white/5 border border-white/10 grid place-items-center text-white/80">☰</button>
          <div className="flex-1 min-w-0">
            <p className="font-black leading-none">YARD<span className="text-[#baff39]">.</span> <span className="text-white/30 text-sm font-bold ml-1">{section}</span></p>
            <p className="text-[11px] text-white/30 truncate">{NAV_GROUPS.flatMap(g=>g.items).find(i=>i.key===section)?.desc}</p>
          </div>
          <span className="text-[10px] font-bold tracking-widest border border-white/10 rounded-full px-2 py-1 text-white/30">ADMIN</span>
        </header>

        {/* Desktop top bar */}
        <div className="hidden md:flex items-center justify-between px-8 py-5 border-b border-white/[0.06] bg-[#080808]/50">
          <div>
            <h1 className="text-2xl font-black tracking-tight flex items-center gap-3">
              <span className={`w-9 h-9 rounded-xl grid place-items-center text-lg border ${section==="Reports" ? "bg-red-500/10 border-red-500/20" : section==="Payouts" ? "bg-[#baff39]/10 border-[#baff39]/20" : "bg-white/5 border-white/10"}`}>
                {NAV_GROUPS.flatMap(g=>g.items).find(i=>i.key===section)?.icon}
              </span>
              {section}
            </h1>
            <p className="text-sm text-white/35 mt-1">{NAV_GROUPS.flatMap(g=>g.items).find(i=>i.key===section)?.desc}</p>
          </div>
          <div className="flex items-center gap-2">
            {section==="Reports" && <span className={`text-xs font-bold px-3 py-1.5 rounded-full border ${reports.length>0 ? "bg-red-500/10 text-red-400 border-red-500/20" : "bg-white/5 text-white/30 border-white/10"}`}>{reports.length} open</span>}
            {section==="Payouts" && <span className={`text-xs font-bold px-3 py-1.5 rounded-full border ${payouts.length>0 ? "bg-[#baff39]/10 text-[#baff39] border-[#baff39]/20" : "bg-white/5 text-white/30 border-white/10"}`}>{payouts.length} pending</span>}
            <button onClick={() => loadAll()} className="btn-ghost text-sm">↻ Refresh</button>
          </div>
        </div>

        <main className="flex-1 px-4 md:px-8 py-6 max-w-5xl w-full mx-auto md:mx-0">
          {section === "Overview" && stats && (
            <div className="space-y-6">
              <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
                <div className="card p-4"><p className="text-xs text-white/40">Users</p><p className="text-2xl font-black mt-1">{stats.userCount}</p><p className="text-[11px] text-white/20 mt-1">total registered</p></div>
                <div className="card p-4"><p className="text-xs text-white/40">Active (7d)</p><p className="text-2xl font-black mt-1">{stats.activeUsers}</p><p className="text-[11px] text-white/20 mt-1">post/comment/vote</p></div>
                <div className="card p-4"><p className="text-xs text-white/40">Posts</p><p className="text-2xl font-black mt-1">{stats.postCount}</p><p className="text-[11px] text-white/20 mt-1">total</p></div>
                <div className="card p-4"><p className="text-xs text-white/40">Prime / Plus</p><p className="text-2xl font-black mt-1">{stats.primeCount} <span className="text-white/30 text-sm font-medium">/</span> {stats.plusCount}</p><p className="text-[11px] text-white/20 mt-1">paid tiers</p></div>
              </div>
              <div className="card p-6 border border-[#baff39]/20" style={{ background: "linear-gradient(135deg, rgba(186,255,57,0.08), rgba(186,255,57,0.02))" }}>
                <p className="text-xs text-white/50 uppercase tracking-widest font-bold">Total revenue (confirmed)</p>
                <p className="text-4xl font-black text-[#baff39] mt-2 tracking-tight">{ghs(stats.revenuePesewas)}</p>
                <p className="text-xs text-white/30 mt-2">Sum of Transaction amount where status=success. Check Paystack dashboard if this looks low — subscription amounts may be 0 if not fixed.</p>
              </div>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div className="card p-4 flex items-center justify-between"><div><p className="text-xs text-white/40">Pending payouts</p><p className="text-xl font-bold mt-1">{ghs(stats.pendingPayoutPesewas)}</p></div><span className="text-2xl opacity-30">⏳</span></div>
                <div className="card p-4 flex items-center justify-between"><div><p className="text-xs text-white/40">Paid out</p><p className="text-xl font-bold mt-1">{ghs(stats.paidOutPesewas)}</p></div><span className="text-2xl opacity-30">✅</span></div>
              </div>
              <div className="card p-4 bg-white/[0.02]">
                <p className="text-xs font-bold text-white/50 uppercase tracking-widest mb-2">Quick actions</p>
                <div className="flex flex-wrap gap-2">
                  <button className="btn-ghost text-sm" onClick={() => setSection("Reports")}>Go to Reports →</button>
                  <button className="btn-ghost text-sm" onClick={() => setSection("Payouts")}>Go to Payouts →</button>
                  <button className="btn-ghost text-sm" onClick={() => setSection("Battles")}>Create Battle →</button>
                </div>
              </div>
            </div>
          )}

          {section === "Reports" && (
            <div className="space-y-3">
              <div className="flex items-center justify-between">
                <p className="text-sm text-white/40">{reports.length} open {reports.length===1 ? "report" : "reports"} · AI verdict helps triage</p>
                <button onClick={() => loadAll()} className="text-xs text-white/40 hover:text-white/70">Refresh</button>
              </div>
              {reports.length === 0 ? <div className="card p-10 text-center"><p className="text-3xl mb-2">✅</p><p className="text-white/40 text-sm">No open reports. All clear.</p></div> : reports.map((r) => (
                <div key={r.id} className="card p-4 md:p-5">
                  <div className="flex items-start justify-between gap-3">
                    <p className="text-xs text-white/40">Reported by <span className="text-white/70 font-semibold">{r.reporter.ghostId}</span> · ID {r.id.slice(0,8)}…</p>
                    {r.aiVerdict && <span className={`badge flex-shrink-0 ${r.aiVerdict === "VIOLATION" ? "badge-prime" : "badge-boosted"}`}>AI: {r.aiVerdict}</span>}
                  </div>
                  <p className="text-sm text-white/80 mt-2">Reason: <span className="text-white font-medium">{r.reason}</span></p>
                  <p className="text-white/90 text-sm mt-3 p-3 rounded-xl bg-white/[0.03] border border-white/5 whitespace-pre-wrap">{r.post?.text || "(no text / image post)"}</p>
                  <div className="flex gap-2 mt-4">
                    <button disabled={!!busyId} className="btn-ghost flex-1 disabled:opacity-50" onClick={() => handleReportAction(r.id, "dismissed")}>{busyId===r.id ? "…" : "Dismiss"}</button>
                    <button disabled={!!busyId} className="btn-primary flex-1 disabled:opacity-50" onClick={() => handleReportAction(r.id, "actioned")}>{busyId===r.id ? "Working…" : "Remove post"}</button>
                  </div>
                </div>
              ))}
            </div>
          )}

          {section === "Payouts" && (
            <div className="space-y-4">
              <div className="card p-4 border-amber-500/20 bg-amber-500/[0.03]">
                <p className="text-xs font-bold text-amber-400/80 uppercase tracking-widest">⚠️ Real money — checklist before approving</p>
                <ul className="text-xs text-white/50 mt-2 space-y-1 list-disc pl-4">
                  <li>Verify user is Prime, has earnings, and bank/MoMo details look valid.</li>
                  <li>Approved → Paystack transfer created (GHS). Ensure Paystack balance covers amount.</li>
                  <li>After approval status becomes <b className="text-white/70">approved</b> → webhook confirms <b className="text-white/70">paid</b> or <b className="text-white/70">rejected</b>.</li>
                  <li>If Transfer fails, payout reverts to <b className="text-white/70">pending</b> for retry.</li>
                </ul>
              </div>
              <div className="flex items-center justify-between text-sm">
                <p className="text-white/40">{payouts.length} pending payout{payouts.length!==1?"s":""} · Total {ghs(payouts.reduce((a,p)=>a+p.amount,0))}</p>
                <button onClick={() => loadAll()} className="text-xs text-white/40 hover:text-white/70">Refresh</button>
              </div>
              {payouts.length === 0 ? <div className="card p-10 text-center"><p className="text-3xl mb-2">💸</p><p className="text-white/40 text-sm">No pending payouts.</p><p className="text-white/20 text-xs mt-1">Approved/paid and failed are hidden here — check stats for totals and webhook logs for status.</p></div> : payouts.map((p) => (
                <div key={p.id} className="card p-4 md:p-5">
                  <div className="flex items-start justify-between gap-3">
                    <div className="min-w-0">
                      <p className="text-sm font-bold truncate">{p.user.ghostId}</p>
                      <p className="text-xs text-white/40 truncate">{p.user.email} · {p.id.slice(0,8)}…</p>
                    </div>
                    <span className="text-sm font-black bg-[#baff39]/10 border border-[#baff39]/20 text-[#baff39] px-3 py-1 rounded-full flex-shrink-0">{ghs(p.amount)}</span>
                  </div>
                  <div className="mt-3 p-3 rounded-xl bg-white/[0.03] border border-white/5">
                    <p className="text-[11px] tracking-widest font-bold text-white/25 uppercase">Recipient</p>
                    <p className="text-xs text-white/60 mt-1 break-all">{p.accountName || "—"} · {p.accountNumber || "—"} · <span className="font-mono">{p.bankCode || "—"}</span></p>
                    <p className="text-[11px] text-white/20 mt-1">If you see hex like “a3f1:…” it means details are still encrypted — backend decrypt fix not yet deployed. Do not approve until readable.</p>
                  </div>
                  <button disabled={!!busyId} className="btn-primary w-full mt-3 disabled:opacity-50" onClick={() => handleApprovePayout(p.id)}>{busyId===p.id ? "Processing…" : "Approve & Pay via Paystack"}</button>
                </div>
              ))}
            </div>
          )}

          {section === "Users" && (
            <div className="space-y-4">
              <div>
                <input className="input" placeholder="Search ghost name…" value={userSearch} onChange={(e) => setUserSearch(e.target.value)} />
                <p className="text-[11px] text-white/25 mt-1.5 px-1">Search is debounced · 30 max · clear to list recent</p>
              </div>
              {users.length===0 ? <p className="text-white/30 text-sm text-center py-8">{userSearch ? "No ghosts match." : "Type to search users."}</p> :
              <div className="space-y-2">
                {users.map((u) => (
                  <div key={u.id} className="card p-3 flex items-center justify-between gap-3">
                    <div className="min-w-0 flex-1">
                      <p className="text-sm font-semibold truncate">{u.ghostId} {u.tier !== "FREE" && <span className="badge badge-prime ml-1">{u.tier}</span>}</p>
                      <p className="text-xs text-white/40 truncate">{u.email} · {u.campus}</p>
                      <p className="text-[11px] font-mono text-white/20 truncate">{u.id}</p>
                    </div>
                    <button disabled={!!busyId} className={`text-xs font-bold px-3 py-1.5 rounded-full border flex-shrink-0 disabled:opacity-50 ${busyId===u.id?"bg-white/5 border-white/10 text-white/30":"bg-red-500/10 border-red-500/20 text-red-400 hover:bg-red-500/15"}`} onClick={() => handleDeleteUser(u.id)}>{busyId===u.id ? "…" : "Manage"}</button>
                  </div>
                ))}
              </div>}
              <p className="text-[11px] text-white/20 px-1">Manage → Suspend (soft) / Ban (hard) · If user has posts, hard delete will fail — use suspend/ban. Status is ACTIVE/SUSPENDED/BANNED.</p>
            </div>
          )}

          {section === "Posts" && (
            <div className="space-y-4">
              <div>
                <input className="input" placeholder="Search post text…" value={postSearch} onChange={(e) => setPostSearch(e.target.value)} />
                <p className="text-[11px] text-white/25 mt-1.5 px-1">Debounced · 30 max · shows ghost + snippet</p>
              </div>
              {posts.length===0 ? <p className="text-white/30 text-sm text-center py-8">{postSearch ? "No posts match." : "Type to search posts."}</p> :
              <div className="space-y-2">
                {posts.map((p) => (
                  <div key={p.id} className="card p-3 flex items-center justify-between gap-3">
                    <div className="min-w-0 flex-1">
                      <p className="text-xs text-white/40">{p.user.ghostId} · <span className="font-mono text-white/20">{p.id.slice(0,8)}…</span></p>
                      <p className="text-sm truncate">{p.text || "(image/voice post)"}</p>
                    </div>
                    <button disabled={!!busyId} className="text-red-400 text-xs font-bold px-3 py-1.5 rounded-full border border-red-500/20 bg-red-500/10 hover:bg-red-500/15 disabled:opacity-50 flex-shrink-0" onClick={() => handleDeletePost(p.id)}>{busyId===p.id?"…":"Delete"}</button>
                  </div>
                ))}
              </div>}
            </div>
          )}

          {section === "Battles" && (
            <div className="max-w-xl space-y-4">
              <div className="card p-5">
                <p className="font-bold">Create Battle Prompt</p>
                <p className="text-xs text-white/30 mt-1">Campus + prompt creates an ACTIVE prompt lasting 7 days. Use API for advanced (BRACKET, recurrence, seasons).</p>
                <input className="input mt-4" placeholder="Prompt text — e.g. Best Jollof on campus?" value={promptText} onChange={(e) => setPromptText(e.target.value)} />
                <select className="input mt-2" value={campus} onChange={(e) => setCampus(e.target.value)}>
                  <option value="">Select school</option>
                  {CAMPUSES.map((c) => (
                    <option key={c} value={c}>{c}</option>
                  ))}
                </select>
                <button disabled={busyId==="battle"} className="btn-primary w-full mt-3 disabled:opacity-50" onClick={handleCreateBattle}>{busyId==="battle" ? "Creating…" : "Create (7 days)"}</button>
              </div>
              <div className="card p-4 bg-white/[0.02]">
                <p className="text-xs font-bold text-white/40 uppercase tracking-widest">API tips</p>
                <p className="text-xs text-white/30 mt-2 leading-relaxed">POST <span className="text-white/60 font-mono">/api/admin/battles/create</span> accepts <span className="text-white/60">type: SINGLE|BRACKET, totalRounds, entryType: TEXT|IMAGE|VOICE, isPrimeOnly, schedule, scheduleDays, seasonId</span>. GET same route lists 50 prompts. Check <span className="text-white/60 font-mono">app/api/admin/battles/create/route.ts</span> for valid campuses.</p>
              </div>
            </div>
          )}
        </main>

        <footer className="px-4 md:px-8 py-6 border-t border-white/[0.04] mt-auto">
          <p className="text-[11px] text-white/20">Yard Admin · Be careful with money actions · Audit log at <span className="font-mono">AuditLog</span> table · Payout encryption key must be set (<span className="font-mono">PAYOUT_ENCRYPTION_KEY</span>)</p>
        </footer>
      </div>
    </div>
  )
}
