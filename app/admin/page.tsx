"use client"

import { useCallback, useEffect, useMemo, useState } from "react"
import { useRouter } from "next/navigation"
import { motion, AnimatePresence } from "framer-motion"
import { BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer, Cell } from "recharts"

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
  status?: string
  accountName: string | null
  accountNumber: string | null
  bankCode: string | null
  user: { ghostId: string; email: string }
}

type AdminUser = { id: string; ghostId: string; email: string; campus: string; tier: string }
type AdminPost = { id: string; text: string | null; user: { ghostId: string } }

type SectionKey = "Overview" | "Insights" | "Users" | "Posts" | "Reports" | "Payouts" | "Battles" | "Settings"

const NAV: { key: SectionKey; label: string; icon: string; desc: string; group: string }[] = [
  { key: "Overview", label: "Overview", icon: "▦", desc: "Revenue & health", group: "General" },
  { key: "Insights", label: "Insights", icon: "◊", desc: "Growth & money", group: "General" },
  { key: "Users", label: "Users", icon: "○", desc: "Search & manage", group: "Manage" },
  { key: "Posts", label: "Posts", icon: "▤", desc: "Search & delete", group: "Manage" },
  { key: "Reports", label: "Reports", icon: "⚑", desc: "Flagged posts", group: "Moderation" },
  { key: "Battles", label: "Battles", icon: "⚔", desc: "Create prompts", group: "Moderation" },
  { key: "Payouts", label: "Payouts", icon: "₵", desc: "Creator payments", group: "Finance" },
  { key: "Settings", label: "Settings", icon: "⚙", desc: "Keys & config", group: "System" },
]

const GROUPS = ["General", "Manage", "Moderation", "Finance", "System"]

const CAMPUSES = ["University of Ghana", "KNUST", "UCC", "GCTU", "UPSA"]

function ghs(pesewas: number) {
  return `GH₵${(pesewas / 100).toLocaleString("en-GH", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`
}

async function adminFetch(url: string, opts: RequestInit = {}) {
  const res = await fetch(url, { ...opts, credentials: "include" })
  const text = await res.text()
  let data: Record<string, unknown> = {}
  try { data = text ? (JSON.parse(text) as Record<string, unknown>) : {} } catch { data = { error: text || "Request failed." } }
  if (!res.ok) throw new Error(typeof data.error === "string" ? data.error : `Request failed (${res.status})`)
  return data as unknown as { reports?: Report[]; payouts?: Payout[]; users?: AdminUser[]; posts?: AdminPost[] } & Stats
}

function errMsg(e: unknown, fallback: string) {
  return e instanceof Error ? e.message : fallback
}

/* ---------- small primitives ---------- */

function TierBadge({ tier }: { tier: string }) {
  const t = tier?.toUpperCase() || "FREE"
  if (t === "PRIME")
    return <span className="inline-flex items-center gap-1 text-[11px] font-bold px-2.5 py-1 rounded-full bg-[#facc15]/10 border border-[#facc15]/25 text-[#facc15]">👑 PRIME</span>
  if (t === "PLUS")
    return <span className="inline-flex items-center gap-1 text-[11px] font-bold px-2.5 py-1 rounded-full bg-sky-500/10 border border-sky-500/25 text-sky-300">★ PLUS</span>
  return <span className="inline-flex items-center gap-1 text-[11px] font-bold px-2.5 py-1 rounded-full bg-white/[0.05] border border-white/10 text-white/50">FREE</span>
}

function StatCard({ label, value, sub, icon, accent, trend }: { label: string; value: string; sub: string; icon: string; accent: string; trend?: string }) {
  return (
    <div className="rounded-2xl border border-white/10 bg-white/[0.03] p-4 flex flex-col justify-between min-h-[128px] hover:border-white/20 transition-colors">
      <div className="flex items-center justify-between">
        <p className="text-[11px] font-bold uppercase tracking-[0.12em] text-white/40">{label}</p>
        <span className="w-7 h-7 rounded-lg grid place-items-center text-sm border" style={{ background: `${accent}14`, borderColor: `${accent}30` }}>{icon}</span>
      </div>
      <div className="mt-3">
        <p className="text-[26px] leading-none font-black tracking-tight text-white">{value}</p>
        <div className="flex items-center gap-2 mt-1.5">
          <p className="text-xs text-white/35">{sub}</p>
          {trend && <span className="text-[11px] font-bold px-1.5 py-0.5 rounded-md" style={{ background: `${accent}14`, color: accent }}>{trend}</span>}
        </div>
      </div>
      <div className="h-1 rounded-full bg-white/[0.06] mt-3 overflow-hidden">
        <div className="h-full rounded-full" style={{ width: "100%", background: accent, opacity: 0.7 }} />
      </div>
    </div>
  )
}

function Card({ children, className = "" }: { children: React.ReactNode; className?: string }) {
  return <div className={`rounded-2xl border border-white/10 bg-white/[0.03] ${className}`}>{children}</div>
}

function CardHeader({ title, sub, right }: { title: string; sub?: string; right?: React.ReactNode }) {
  return (
    <div className="flex items-start justify-between gap-3 px-5 pt-4 pb-3 border-b border-white/[0.06]">
      <div>
        <h3 className="font-bold text-[15px] tracking-tight">{title}</h3>
        {sub && <p className="text-xs text-white/35 mt-0.5">{sub}</p>}
      </div>
      {right}
    </div>
  )
}

function EmptyState({ icon, title, sub, action }: { icon: string; title: string; sub: string; action?: React.ReactNode }) {
  return (
    <div className="rounded-2xl border border-white/10 bg-white/[0.02] p-10 text-center">
      <p className="text-4xl mb-2">{icon}</p>
      <p className="font-bold text-white/80">{title}</p>
      <p className="text-xs text-white/30 mt-1">{sub}</p>
      {action && <div className="mt-4 flex justify-center">{action}</div>}
    </div>
  )
}

const th = "text-left text-[11px] font-bold uppercase tracking-[0.1em] text-white/35 px-4 py-3 whitespace-nowrap"
const td = "px-4 py-3 text-sm align-middle"

/* ---------- main page ---------- */

export default function AdminPage() {
  const router = useRouter()
  const [section, setSection] = useState<SectionKey>("Overview")
  const [drawer, setDrawer] = useState(false)
  const [notAllowed, setNotAllowed] = useState(false)
  const [loading, setLoading] = useState(true)
  const [refreshing, setRefreshing] = useState(false)
  const [busyId, setBusyId] = useState<string | null>(null)

  const [stats, setStats] = useState<Stats | null>(null)
  const [reports, setReports] = useState<Report[]>([])
  const [payouts, setPayouts] = useState<Payout[]>([])
  const [users, setUsers] = useState<AdminUser[]>([])
  const [posts, setPosts] = useState<AdminPost[]>([])
  const [metrics, setMetrics] = useState<null | { range: number; dau: {day:string;count:number}[]; postsPerDay: {day:string;count:number}[]; paywallHits: {day:string;count:number}[]; funnel: {hits:number;checkoutStarted:number;paid:number}; conversion: {userCount:number;plusCount:number;primeCount:number;plusRate:number;primeRate:number;paidRate:number}; arppuPesewas:number; revenuePesewas:number; paidOutPesewas:number; payoutRatio:number }>(null)
  const [range, setRange] = useState<7|30>(30)
  const [metricsError, setMetricsError] = useState<string | null>(null)
  const [metricsLoading, setMetricsLoading] = useState(false)
  const [userSearch, setUserSearch] = useState("")
  const [tierFilter, setTierFilter] = useState("ALL")
  const [postSearch, setPostSearch] = useState("")
  const [payoutTab, setPayoutTab] = useState<"pending" | "paid" | "all">("pending")

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
        setReports(r.reports || [])
        setPayouts(p.payouts || [])
      })
      .catch((err: unknown) => {
        if (isCurrent() && err instanceof Error && (err.message.includes("Not authorized") || err.message.includes("403"))) setNotAllowed(true)
      })
      .finally(() => { if (isCurrent()) setLoading(false) })
  }, [])

  useEffect(() => {
    let active = true
    loadAll(() => active)
    return () => { active = false }
  }, [loadAll])

  useEffect(() => { if (notAllowed) router.push("/admin/login") }, [notAllowed, router])

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

  // Payout tab fetch (pending is default set, paid/all fetched on demand)
  useEffect(() => {
    if (section !== "Payouts") return
    if (payoutTab === "pending") {
      adminFetch("/api/admin/payouts").then((d) => setPayouts(d.payouts || [])).catch(() => {})
    } else {
      const q = payoutTab === "paid" ? "?status=paid" : "?status=all"
      adminFetch(`/api/admin/payouts${q}`).then((d) => setPayouts(d.payouts || [])).catch(() => {})
    }
  }, [section, payoutTab])

  useEffect(() => {
    if (section !== "Insights") return
    let active = true
    adminFetch("/api/admin/metrics?range="+range)
      .then((d) => {
        if (!active) return
        setMetrics(d as unknown as { range: number; dau: {day:string;count:number}[]; postsPerDay: {day:string;count:number}[]; paywallHits: {day:string;count:number}[]; funnel: {hits:number;checkoutStarted:number;paid:number}; conversion: {userCount:number;plusCount:number;primeCount:number;plusRate:number;primeRate:number;paidRate:number}; arppuPesewas:number; revenuePesewas:number; paidOutPesewas:number; payoutRatio:number })
        setMetricsError(null)
      })
      .catch((e: unknown) => {
        if (!active) return
        setMetrics(null)
        const msg = errMsg(e, "Failed to load metrics.")
        setMetricsError(msg.includes("404") ? "Metrics API not deployed yet" : msg)
      })
      .finally(() => { if (active) setMetricsLoading(false) })
    return () => { active = false }
  }, [section, range])

  const refresh = useCallback(async () => {
    setRefreshing(true)
    await loadAll()
    if (section === "Users") {
      try { const d = await adminFetch(`/api/admin/users?search=${encodeURIComponent(userSearch)}`); setUsers(d.users || []) } catch {}
    }
    if (section === "Posts") {
      try { const d = await adminFetch(`/api/admin/posts?search=${encodeURIComponent(postSearch)}`); setPosts(d.posts || []) } catch {}
    }
    setRefreshing(false)
  }, [loadAll, section, userSearch, postSearch])

  async function handleReportAction(id: string, decision: "actioned" | "dismissed") {
    if (busyId) return
    setBusyId(id)
    try {
      await adminFetch(`/api/admin/reports/${id}/action`, {
        method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ decision }),
      })
      await loadAll()
    } catch (e: unknown) { alert(errMsg(e, "Failed to update report")) }
    finally { setBusyId(null) }
  }

  async function handleApprovePayout(id: string) {
    if (busyId) return
    if (!confirm("Approve this payout via Paystack? This sends REAL money.")) return
    setBusyId(id)
    try {
      await adminFetch(`/api/admin/payouts/${id}/approve`, { method: "POST" })
      alert("Payout approved — transfer initiated.")
      await loadAll()
    } catch (e: unknown) { alert(errMsg(e, "Transfer failed. Check Paystack balance / keys.")) }
    finally { setBusyId(null) }
  }

  async function handleUserAction(id: string, action: "suspend" | "ban" | "delete") {
    if (busyId) return
    if (action === "delete") {
      if (!confirm("Hard delete user permanently? Only works if user has no posts.")) return
      try {
        setBusyId(id)
        await adminFetch(`/api/admin/users/${id}`, { method: "DELETE" })
        setUsers((prev) => prev.filter((u) => u.id !== id))
      } catch (e: unknown) { alert(errMsg(e, "Delete failed — user has posts. Suspend/ban instead.")) }
      finally { setBusyId(null) }
      return
    }
    if (!confirm(`${action === "ban" ? "BAN" : "Suspend"} this user?`)) return
    try {
      setBusyId(id)
      await adminFetch(`/api/admin/users/${id}`, {
        method: "PATCH", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ action }),
      })
      const d = await adminFetch(`/api/admin/users?search=${encodeURIComponent(userSearch)}`)
      setUsers(d.users || [])
    } catch (e: unknown) { alert(errMsg(e, "Action failed.")) }
    finally { setBusyId(null) }
  }

  async function handleDeletePost(id: string) {
    if (!confirm("Delete this post?")) return
    try {
      setBusyId(id)
      await adminFetch(`/api/admin/posts/${id}`, { method: "DELETE" })
      setPosts((prev) => prev.filter((p) => p.id !== id))
      loadAll()
    } catch (e: unknown) { alert(errMsg(e, "Delete failed.")) }
    finally { setBusyId(null) }
  }

  async function handleCreateBattle() {
    if (!promptText.trim() || !campus.trim()) { alert("Prompt and campus required"); return }
    if (busyId) return
    setBusyId("battle")
    try {
      await adminFetch("/api/admin/battles/create", {
        method: "POST", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ text: promptText, campus, durationHours: 24 }),
      })
      alert("Battle created.")
      setPromptText(""); setCampus("")
    } catch (e: unknown) { alert(errMsg(e, "Failed to create battle.")) }
    finally { setBusyId(null) }
  }

  const freeCount = Math.max(0, stats ? stats.userCount - stats.primeCount - stats.plusCount : 0)
  const total = Math.max(1, stats?.userCount || 1)
  const paidTotal = (stats?.primeCount || 0) + (stats?.plusCount || 0)
  const tierData = useMemo(() => ([
    { name: "Prime", value: stats?.primeCount || 0, color: "#facc15" },
    { name: "Plus", value: stats?.plusCount || 0, color: "#38bdf8" },
    { name: "Free", value: freeCount, color: "#baff39" },
  ]), [stats, freeCount])

  const filteredUsers = useMemo(() => {
    if (tierFilter === "ALL") return users
    return users.filter((u) => u.tier?.toUpperCase() === tierFilter)
  }, [users, tierFilter])

  if (notAllowed) return null
  if (loading) {
    return (
      <div className="min-h-screen bg-[#050505] lg:flex">
        <div className="hidden lg:block w-[260px] shrink-0 border-r border-white/[0.06] bg-[#080808]" />
        <div className="flex-1 p-6 lg:p-8 max-w-[1240px] w-full mx-auto space-y-4">
          <div className="h-8 w-48 rounded-lg skeleton-shimmer" />
          <div className="grid grid-cols-2 xl:grid-cols-5 gap-3">
            {[...Array(5)].map((_, i) => <div key={i} className="h-[128px] rounded-2xl skeleton-shimmer" />)}
          </div>
          <div className="grid lg:grid-cols-3 gap-4">
            <div className="lg:col-span-2 h-[280px] rounded-2xl skeleton-shimmer" />
            <div className="h-[280px] rounded-2xl skeleton-shimmer" />
          </div>
          <p className="text-center text-white/30 text-sm pt-6">Loading admin…</p>
        </div>
      </div>
    )
  }

  const activeMeta = NAV.find((n) => n.key === section)!
  const go = (s: SectionKey) => { if (s === "Insights") { setMetricsLoading(true); setMetricsError(null) } setSection(s); setDrawer(false) }

  const sidebarNav = (
    <div className="flex-1 overflow-y-auto px-3 py-4 space-y-5 no-scrollbar">
      {GROUPS.map((g) => (
        <div key={g}>
          <p className="text-[10px] font-bold tracking-[0.16em] text-white/25 uppercase px-3 mb-1.5">{g}</p>
          <div className="space-y-1">
            {NAV.filter((n) => n.group === g).map((n) => {
              const active = section === n.key
              const count = n.key === "Reports" ? reports.length : n.key === "Payouts" ? payouts.length : 0
              return (
                <button
                  key={n.key}
                  onClick={() => go(n.key)}
                  aria-current={active ? "page" : undefined}
                  className={`w-full flex items-center gap-3 px-3 py-2.5 rounded-xl text-left transition-all border-l-[3px] ${
                    active
                      ? "bg-[#baff39] text-black border-[#baff39] font-bold"
                      : "border-transparent text-white/55 hover:bg-white/[0.05] hover:text-white"
                  }`}
                >
                  <span className={`w-8 h-8 rounded-lg grid place-items-center text-[15px] shrink-0 font-black ${active ? "bg-black/10" : "bg-white/[0.06]"}`}>{n.icon}</span>
                  <span className="flex-1 min-w-0">
                    <span className="block text-sm leading-none">{n.label}</span>
                    <span className={`block text-[11px] mt-1 ${active ? "text-black/60" : "text-white/30"}`}>{n.desc}</span>
                  </span>
                  {count > 0 && (
                    <span className={`text-[11px] font-black px-2 py-0.5 rounded-full shrink-0 ${active ? "bg-black text-[#baff39]" : n.key === "Reports" ? "bg-red-500/15 text-red-400 border border-red-500/25" : "bg-[#baff39]/10 text-[#baff39] border border-[#baff39]/25"}`}>
                      {count > 99 ? "99+" : count}
                    </span>
                  )}
                </button>
              )
            })}
          </div>
        </div>
      ))}
    </div>
  )

  return (
    <div className="min-h-screen bg-[#050505] text-white lg:flex">
      {/* subtle backdrop */}
      <div className="fixed inset-0 pointer-events-none" aria-hidden="true">
        <div className="absolute inset-x-0 top-0 h-[280px] bg-[radial-gradient(ellipse_60%_100%_at_50%_0%,rgba(186,255,57,0.07),transparent)]" />
      </div>

      {/* ===== Desktop sidebar (fixed 260px) ===== */}
      <aside className="hidden lg:flex w-[260px] shrink-0 sticky top-0 h-screen flex-col border-r border-white/[0.07] bg-[#080808]/95 backdrop-blur-xl z-20 relative">
        <div className="px-5 pt-6 pb-4 border-b border-white/[0.06]">
          <div className="flex items-center gap-2.5">
            <span className="font-black text-xl tracking-tight">YARD<span className="text-[#baff39]">.</span></span>
            <span className="text-[10px] font-black tracking-[0.14em] text-black bg-[#baff39] rounded-full px-2 py-0.5">ADMIN</span>
          </div>
          <p className="text-xs text-white/30 mt-2 flex items-center gap-1.5">
            <span className="w-1.5 h-1.5 rounded-full bg-[#baff39] animate-pulse" />
            Control Center · {stats?.userCount?.toLocaleString() || 0} users
          </p>
        </div>

        {sidebarNav}

        <div className="p-3 border-t border-white/[0.06] space-y-2">
          {(payouts.length > 0) && (
            <button onClick={() => go("Payouts")} className="w-full rounded-xl border border-amber-500/25 bg-amber-500/[0.07] px-3 py-2.5 flex items-center justify-between hover:bg-amber-500/[0.12] transition-colors">
              <span className="text-xs font-bold text-amber-300">⏳ {payouts.length} payouts pending</span>
              <span className="text-xs font-black text-amber-300">→</span>
            </button>
          )}
          <button onClick={() => router.push("/feed")} className="w-full rounded-xl border border-white/10 px-3 py-2.5 text-sm font-semibold text-white/70 hover:bg-white/5 hover:text-white transition-colors">
            ← Back to Yard
          </button>
        </div>
      </aside>

      {/* ===== Mobile drawer ===== */}
      <AnimatePresence>
        {drawer && (
          <div className="fixed inset-0 z-50 lg:hidden">
            <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} className="absolute inset-0 bg-black/70" onClick={() => setDrawer(false)} />
            <motion.div initial={{ x: -300 }} animate={{ x: 0 }} exit={{ x: -300 }} transition={{ type: "spring", damping: 28, stiffness: 260 }} className="absolute left-0 top-0 bottom-0 w-[280px] bg-[#0a0a0a] border-r border-white/10 flex flex-col">
              <div className="px-5 py-4 border-b border-white/10 flex items-center justify-between">
                <span className="font-black">YARD<span className="text-[#baff39]">.</span> <span className="text-[10px] bg-[#baff39] text-black rounded-full px-2 py-0.5 ml-1 font-black">ADMIN</span></span>
                <button onClick={() => setDrawer(false)} className="w-8 h-8 rounded-full bg-white/5 grid place-items-center text-white/60">✕</button>
              </div>
              <div className="flex-1 overflow-y-auto">{sidebarNav}</div>
              <div className="p-3 border-t border-white/10">
                <button onClick={() => { router.push("/feed"); setDrawer(false) }} className="w-full rounded-xl border border-white/10 py-2.5 text-sm text-white/70">← Back to Yard</button>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>

      {/* ===== Main column ===== */}
      <div className="flex-1 min-w-0 flex flex-col relative">
        {/* Top bar */}
        <header className="sticky top-0 z-30 bg-[#050505]/90 backdrop-blur-xl border-b border-white/[0.06]">
          <div className="mx-auto w-full max-w-[1240px] px-4 sm:px-6 lg:px-8 h-16 flex items-center gap-3">
            <button onClick={() => setDrawer(true)} aria-label="Open navigation" className="lg:hidden w-10 h-10 rounded-xl bg-white/5 border border-white/10 grid place-items-center shrink-0">☰</button>
            <span className="lg:hidden font-black">YARD<span className="text-[#baff39]">.</span></span>
            <div className="hidden lg:flex items-center gap-3 min-w-0">
              <span className="w-9 h-9 rounded-xl grid place-items-center text-lg bg-white/5 border border-white/10 shrink-0">{activeMeta.icon}</span>
              <div className="min-w-0">
                <h1 className="text-lg font-black tracking-tight leading-none">{section}</h1>
                <p className="text-xs text-white/35 mt-1 truncate">{activeMeta.desc}</p>
              </div>
            </div>
            <div className="flex-1" />
            {section === "Reports" && reports.length > 0 && (
              <span className="hidden sm:inline-flex items-center gap-1.5 text-xs font-bold px-3 py-1.5 rounded-full bg-red-500/10 text-red-400 border border-red-500/25">
                <span className="w-1.5 h-1.5 rounded-full bg-red-400 animate-pulse" />{reports.length} open
              </span>
            )}
            {section === "Payouts" && payouts.length > 0 && (
              <span className="hidden sm:inline-flex text-xs font-bold px-3 py-1.5 rounded-full bg-[#baff39]/10 text-[#baff39] border border-[#baff39]/25">{payouts.length} pending</span>
            )}
            <span className="hidden md:inline-flex items-center gap-1.5 text-xs text-white/30"><span className="w-1.5 h-1.5 rounded-full bg-[#baff39]" />Live</span>
            <button onClick={refresh} disabled={refreshing} className="rounded-xl border border-white/10 px-3.5 py-2 text-sm font-semibold text-white/70 hover:bg-white/5 hover:text-white disabled:opacity-50 transition-colors">
              {refreshing ? "Refreshing…" : "↻ Refresh"}
            </button>
          </div>
          {/* mobile tab rail */}
          <div className="lg:hidden border-t border-white/[0.05] overflow-x-auto no-scrollbar">
            <div className="flex gap-1.5 px-4 py-2 w-max">
              {NAV.map((n) => (
                <button key={n.key} onClick={() => go(n.key)} className={`text-xs font-bold px-3 py-1.5 rounded-full whitespace-nowrap border transition-colors ${section === n.key ? "bg-[#baff39] text-black border-[#baff39]" : "border-white/10 text-white/50"}`}>{n.label}</button>
              ))}
            </div>
          </div>
        </header>

        {/* Content */}
        <main className="mx-auto w-full max-w-[1240px] px-4 sm:px-6 lg:px-8 py-5 lg:py-7 pb-16">
          <AnimatePresence mode="wait">
            <motion.div key={section} initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -8 }} transition={{ duration: 0.2 }}>

              {/* ============ OVERVIEW ============ */}
              {section === "Overview" && stats && (
                <div className="space-y-4">
                  <div className="grid grid-cols-2 md:grid-cols-3 xl:grid-cols-5 gap-3">
                    <StatCard label="Total Users" value={stats.userCount.toLocaleString()} sub="registered" icon="👥" accent="#baff39" />
                    <StatCard label="Active 7d" value={stats.activeUsers.toLocaleString()} sub="post · comment · vote" icon="⚡" accent="#38bdf8" trend={`${total ? Math.round(stats.activeUsers / total * 100) : 0}%`} />
                    <StatCard label="Posts" value={stats.postCount.toLocaleString()} sub="total" icon="📝" accent="#facc15" />
                    <StatCard label="Revenue" value={ghs(stats.revenuePesewas)} sub="Paystack success" icon="💰" accent="#baff39" />
                    <StatCard label="Paid Tiers" value={paidTotal.toLocaleString()} sub={`${stats.primeCount} Prime · ${stats.plusCount} Plus`} icon="💎" accent="#a855f7" trend={`${total ? Math.round(paidTotal / total * 100) : 0}% paid`} />
                  </div>

                  <div className="grid lg:grid-cols-3 gap-4">
                    <Card className="lg:col-span-2">
                      <CardHeader title="Tier distribution" sub="Who pays — push Free → Plus → Prime" right={
                        <div className="flex gap-3 text-[11px] text-white/40">
                          {tierData.map((d) => <span key={d.name} className="flex items-center gap-1.5"><span className="w-2 h-2 rounded-full" style={{ background: d.color }} />{d.name} {d.value}</span>)}
                        </div>
                      } />
                      <div className="p-5">
                        <div className="h-[190px]">
                          <ResponsiveContainer width="100%" height="100%">
                            <BarChart data={tierData} margin={{ top: 5, right: 5, left: -18, bottom: 0 }}>
                              <XAxis dataKey="name" tick={{ fill: "rgba(255,255,255,0.45)", fontSize: 12 }} axisLine={false} tickLine={false} />
                              <YAxis tick={{ fill: "rgba(255,255,255,0.35)", fontSize: 11 }} axisLine={false} tickLine={false} />
                              <Tooltip contentStyle={{ background: "#0c0c0c", border: "1px solid rgba(255,255,255,0.12)", borderRadius: "12px", color: "#fff", fontSize: "12px" }} cursor={{ fill: "rgba(255,255,255,0.04)" }} />
                              <Bar dataKey="value" radius={[8, 8, 0, 0]}>
                                {tierData.map((e, i) => <Cell key={i} fill={e.color} />)}
                              </Bar>
                            </BarChart>
                          </ResponsiveContainer>
                        </div>
                        <div className="grid sm:grid-cols-3 gap-2 mt-4">
                          {[
                            { n: "Prime", c: stats.primeCount, color: "#facc15", note: "GH₵20/mo" },
                            { n: "Plus", c: stats.plusCount, color: "#38bdf8", note: "GH₵10/mo" },
                            { n: "Free", c: freeCount, color: "#baff39", note: "upsell pool" },
                          ].map((r) => (
                            <div key={r.n} className="rounded-xl border border-white/[0.07] bg-black/30 p-3">
                              <div className="flex items-center justify-between">
                                <span className="text-xs font-bold" style={{ color: r.color }}>{r.n}</span>
                                <span className="text-sm font-black">{r.c}</span>
                              </div>
                              <div className="h-1.5 rounded-full bg-white/[0.07] mt-2 overflow-hidden">
                                <div className="h-full rounded-full" style={{ width: `${Math.round(r.c / total * 100)}%`, background: r.color }} />
                              </div>
                              <p className="text-[11px] text-white/30 mt-1.5">{Math.round(r.c / total * 100)}% · {r.note}</p>
                            </div>
                          ))}
                        </div>
                      </div>
                    </Card>

                    <div className="space-y-4">
                      <Card>
                        <CardHeader title="Payouts" sub="Money in flight" />
                        <div className="p-4 space-y-2.5">
                          <div className="rounded-xl border border-amber-500/25 bg-amber-500/[0.06] p-3.5 flex items-center justify-between">
                            <div><p className="text-[11px] uppercase tracking-wider font-bold text-amber-300/80">Pending</p><p className="text-xl font-black text-amber-300 mt-0.5">{ghs(stats.pendingPayoutPesewas)}</p></div>
                            <span className="text-2xl opacity-40">⏳</span>
                          </div>
                          <div className="rounded-xl border border-emerald-500/25 bg-emerald-500/[0.06] p-3.5 flex items-center justify-between">
                            <div><p className="text-[11px] uppercase tracking-wider font-bold text-emerald-300/80">Paid out</p><p className="text-xl font-black text-emerald-300 mt-0.5">{ghs(stats.paidOutPesewas)}</p></div>
                            <span className="text-2xl opacity-40">✅</span>
                          </div>
                          <button onClick={() => go("Payouts")} className="w-full rounded-xl bg-[#baff39] text-black text-sm font-bold py-2.5 hover:bg-[#d4ff70] transition-colors">Review payouts →</button>
                        </div>
                      </Card>
                      <Card>
                        <CardHeader title="Quick actions" sub="Jump to work queues" />
                        <div className="p-4 grid grid-cols-3 lg:grid-cols-1 xl:grid-cols-3 gap-2">
                          <button onClick={() => go("Reports")} className="rounded-xl border border-white/10 py-2.5 text-xs font-bold text-white/70 hover:bg-white/5 hover:text-white transition-colors">⚑ Reports{reports.length > 0 ? ` (${reports.length})` : ""}</button>
                          <button onClick={() => go("Users")} className="rounded-xl border border-white/10 py-2.5 text-xs font-bold text-white/70 hover:bg-white/5 hover:text-white transition-colors">○ Users</button>
                          <button onClick={() => go("Battles")} className="rounded-xl border border-white/10 py-2.5 text-xs font-bold text-white/70 hover:bg-white/5 hover:text-white transition-colors">⚔ Battle</button>
                        </div>
                      </Card>
                    </div>
                  </div>

                  <div className="grid lg:grid-cols-2 gap-4">
                    <Card>
                      <CardHeader title="Open reports" sub={`${reports.length} waiting`} right={<button onClick={() => go("Reports")} className="text-xs font-bold text-[#baff39] hover:underline">View all →</button>} />
                      <div className="divide-y divide-white/[0.05]">
                        {reports.slice(0, 3).map((r) => (
                          <div key={r.id} className="px-5 py-3 flex items-center gap-3">
                            <span className={`text-[10px] font-black px-2 py-0.5 rounded-full shrink-0 ${r.aiVerdict === "VIOLATION" ? "bg-red-500/15 text-red-400" : "bg-[#baff39]/10 text-[#baff39]"}`}>{r.aiVerdict || "NO AI"}</span>
                            <p className="text-[13px] text-white/70 truncate flex-1">{r.reason} — <span className="text-white/35">{r.post?.text?.slice(0, 60) || "no text"}</span></p>
                            <span className="text-[11px] text-white/25 font-mono shrink-0">{r.id.slice(0, 6)}</span>
                          </div>
                        ))}
                        {reports.length === 0 && <p className="px-5 py-6 text-sm text-white/30 text-center">✅ All clear — no open reports.</p>}
                      </div>
                    </Card>
                    <Card>
                      <CardHeader title="Pending payouts" sub={`${payouts.length} awaiting approval`} right={<button onClick={() => go("Payouts")} className="text-xs font-bold text-[#baff39] hover:underline">View all →</button>} />
                      <div className="divide-y divide-white/[0.05]">
                        {payouts.slice(0, 3).map((p) => (
                          <div key={p.id} className="px-5 py-3 flex items-center gap-3">
                            <div className="min-w-0 flex-1"><p className="text-[13px] font-bold truncate">{p.user.ghostId}</p><p className="text-[11px] text-white/30 truncate">{p.accountName || "—"} · {p.accountNumber || "—"}</p></div>
                            <span className="text-[13px] font-black text-[#baff39] shrink-0">{ghs(p.amount)}</span>
                          </div>
                        ))}
                        {payouts.length === 0 && <p className="px-5 py-6 text-sm text-white/30 text-center">💸 No pending payouts.</p>}
                      </div>
                    </Card>
                  </div>
                </div>
              )}

              {/* ============ INSIGHTS ============ */}
              {section === "Insights" && (
                <div className="space-y-4">
                  <div className="flex items-center justify-between flex-wrap gap-3">
                    <p className="text-sm text-white/40"><span className="text-white font-black">Growth &amp; money</span> · last {range} days</p>
                    <div className="flex gap-1.5 bg-black/40 border border-white/10 rounded-xl p-1 w-fit">
                      {([7, 30] as const).map((r) => (
                        <button key={r} onClick={() => { setMetricsLoading(true); setRange(r) }} className={`text-xs font-bold px-4 py-2 rounded-lg transition-colors ${range === r ? "bg-[#baff39] text-black" : "text-white/50 hover:text-white"}`}>{r}D</button>
                      ))}
                    </div>
                  </div>

                  {metricsLoading ? (
                    <div className="grid grid-cols-2 md:grid-cols-3 xl:grid-cols-4 gap-3">
                      {[...Array(7)].map((_, i) => <div key={i} className="h-[128px] rounded-2xl skeleton-shimmer" />)}
                    </div>
                  ) : metricsError ? (
                    <EmptyState icon="◊" title={metricsError === "Metrics API not deployed yet" ? "Metrics API not deployed yet" : "Could not load insights"} sub={metricsError === "Metrics API not deployed yet" ? "Deploy /api/admin/metrics to see growth and money." : metricsError} />
                  ) : !metrics ? (
                    <EmptyState icon="◊" title="No insights yet" sub="Waiting for metrics data." />
                  ) : (
                    <div className="space-y-4">
                      {(() => {
                        const dau = metrics.dau || []
                        const perDay = metrics.postsPerDay || []
                        const dauToday = dau.length > 0 ? dau[dau.length - 1].count : 0
                        const dauSum = dau.reduce((a, d) => a + (d.count || 0), 0)
                        const postsAvg = perDay.length > 0 ? perDay.reduce((a, d) => a + (d.count || 0), 0) / perDay.length : 0
                        const hits = metrics.funnel?.hits || 0
                        const paywallPct = dauSum > 0 ? (hits / dauSum) * 100 : 0
                        const plusP = metrics.conversion ? (metrics.conversion.plusRate > 1 ? metrics.conversion.plusRate : metrics.conversion.plusRate * 100) : 0
                        const primeP = metrics.conversion ? (metrics.conversion.primeRate > 1 ? metrics.conversion.primeRate : metrics.conversion.primeRate * 100) : 0
                        const ratio = metrics.payoutRatio || 0
                        const over = ratio > 1
                        return (
                          <div className="grid grid-cols-2 md:grid-cols-3 xl:grid-cols-4 gap-3">
                            <StatCard label="DAU today" value={dauToday.toLocaleString()} sub={`last ${metrics.range || range}d`} icon="⚡" accent="#baff39" />
                            <StatCard label="Posts/day avg" value={postsAvg.toFixed(1)} sub="posts per day" icon="📝" accent="#facc15" />
                            <StatCard label="Paywall-hit %" value={`${paywallPct.toFixed(1)}%`} sub={`${hits.toLocaleString()} hits / DAU`} icon="◊" accent="#38bdf8" />
                            <StatCard label="Plus conv %" value={`${plusP.toFixed(1)}%`} sub={`${(metrics.conversion?.plusCount || 0).toLocaleString()} Plus`} icon="★" accent="#38bdf8" />
                            <StatCard label="Prime conv %" value={`${primeP.toFixed(1)}%`} sub={`${(metrics.conversion?.primeCount || 0).toLocaleString()} Prime`} icon="👑" accent="#facc15" />
                            <StatCard label="ARPPU" value={ghs(metrics.arppuPesewas || 0)} sub={`${ghs(metrics.revenuePesewas || 0)} rev`} icon="💰" accent="#baff39" />
                            <div className="rounded-2xl border border-white/10 bg-white/[0.03] p-4 flex flex-col justify-between min-h-[128px] hover:border-white/20 transition-colors">
                              <div className="flex items-center justify-between">
                                <p className="text-[11px] font-bold uppercase tracking-[0.12em] text-white/40">Payout ratio</p>
                                <span className="w-7 h-7 rounded-lg grid place-items-center text-sm border" style={{ background: `${over ? "#f87171" : "#34d399"}14`, borderColor: `${over ? "#f87171" : "#34d399"}30` }}>₵</span>
                              </div>
                              <div className="mt-3">
                                <p className={`text-[26px] leading-none font-black tracking-tight ${over ? "text-red-400" : "text-white"}`}>{ratio.toFixed(2)}x</p>
                                <div className="flex items-center gap-2 mt-1.5">
                                  <p className="text-xs text-white/35">{ghs(metrics.paidOutPesewas || 0)} paid</p>
                                </div>
                              </div>
                              <div className="h-1 rounded-full bg-white/[0.06] mt-3 overflow-hidden">
                                <div className="h-full rounded-full" style={{ width: `${Math.min(100, ratio * 100)}%`, background: over ? "#f87171" : "#34d399", opacity: 0.7 }} />
                              </div>
                            </div>
                          </div>
                        )
                      })()}

                      <div className="grid lg:grid-cols-2 gap-4">
                        <Card>
                          <CardHeader title="DAU" sub={`Daily active · last ${metrics.range || range}d`} />
                          <div className="p-5">
                            <div className="h-[190px]">
                              <ResponsiveContainer width="100%" height="100%">
                                <BarChart data={(metrics.dau || []).map((d) => ({ ...d, day: d.day.slice(5) }))} margin={{ top: 5, right: 5, left: -18, bottom: 0 }}>
                                  <XAxis dataKey="day" tick={{ fill: "rgba(255,255,255,0.45)", fontSize: 11 }} axisLine={false} tickLine={false} />
                                  <YAxis tick={{ fill: "rgba(255,255,255,0.35)", fontSize: 11 }} axisLine={false} tickLine={false} />
                                  <Tooltip contentStyle={{ background: "#0c0c0c", border: "1px solid rgba(255,255,255,0.12)", borderRadius: "12px", color: "#fff", fontSize: "12px" }} cursor={{ fill: "rgba(255,255,255,0.04)" }} />
                                  <Bar dataKey="count" radius={[8, 8, 0, 0]} fill="#baff39" />
                                </BarChart>
                              </ResponsiveContainer>
                            </div>
                          </div>
                        </Card>
                        <Card>
                          <CardHeader title="Posts / day" sub={`Volume · last ${metrics.range || range}d`} />
                          <div className="p-5">
                            <div className="h-[190px]">
                              <ResponsiveContainer width="100%" height="100%">
                                <BarChart data={(metrics.postsPerDay || []).map((d) => ({ ...d, day: d.day.slice(5) }))} margin={{ top: 5, right: 5, left: -18, bottom: 0 }}>
                                  <XAxis dataKey="day" tick={{ fill: "rgba(255,255,255,0.45)", fontSize: 11 }} axisLine={false} tickLine={false} />
                                  <YAxis tick={{ fill: "rgba(255,255,255,0.35)", fontSize: 11 }} axisLine={false} tickLine={false} />
                                  <Tooltip contentStyle={{ background: "#0c0c0c", border: "1px solid rgba(255,255,255,0.12)", borderRadius: "12px", color: "#fff", fontSize: "12px" }} cursor={{ fill: "rgba(255,255,255,0.04)" }} />
                                  <Bar dataKey="count" radius={[8, 8, 0, 0]} fill="#facc15" />
                                </BarChart>
                              </ResponsiveContainer>
                            </div>
                          </div>
                        </Card>
                      </div>

                      <div className="grid lg:grid-cols-3 gap-4">
                        <Card className="lg:col-span-2">
                          <CardHeader title="Paywall funnel" sub={`Hits → checkout → paid · last ${metrics.range || range}d`} />
                          <div className="p-5 space-y-4">
                            {(() => {
                              const hits = metrics.funnel?.hits || 0
                              const started = metrics.funnel?.checkoutStarted || 0
                              const paid = metrics.funnel?.paid || 0
                              const s1 = hits > 0 ? (started / hits) * 100 : 0
                              const s2 = started > 0 ? (paid / started) * 100 : 0
                              const overall = hits > 0 ? (paid / hits) * 100 : 0
                              const rows = [
                                { n: "Paywall hits", c: hits, pct: 100, color: "#baff39", note: "entry" },
                                { n: "Checkout started", c: started, pct: s1, color: "#38bdf8", note: `${s1.toFixed(1)}% of hits` },
                                { n: "Paid", c: paid, pct: overall, color: "#facc15", note: `${s2.toFixed(1)}% of checkout · ${overall.toFixed(1)}% overall` },
                              ]
                              return rows.map((r) => (
                                <div key={r.n}>
                                  <div className="flex items-center justify-between gap-2">
                                    <p className="text-sm font-bold">{r.n}</p>
                                    <p className="text-sm font-black" style={{ color: r.color }}>{r.c.toLocaleString()} <span className="text-[11px] font-semibold text-white/35 ml-1">{r.note}</span></p>
                                  </div>
                                  <div className="h-2 rounded-full bg-white/[0.07] mt-2 overflow-hidden">
                                    <div className="h-full rounded-full" style={{ width: `${Math.min(100, r.pct)}%`, background: r.color }} />
                                  </div>
                                </div>
                              ))
                            })()}
                          </div>
                        </Card>
                        <Card>
                          <CardHeader title="Paywall logging" sub="Why zeros happen" />
                          <div className="p-5">
                            <p className="text-xs text-white/40 leading-relaxed">Funnel and paywall-hit % need the paywall-hit instrumentation. If hits stay at 0, the client is not logging paywall views and checkout events to <span className="text-white/70 font-mono">/api/admin/metrics</span> yet — wire that up to unlock growth and money reads.</p>
                            <div className="mt-4 rounded-xl border border-[#baff39]/25 bg-[#baff39]/[0.06] p-3">
                              <p className="text-[11px] font-bold text-[#baff39]">ARPPU = revenue / paid users</p>
                              <p className="text-[11px] text-white/40 mt-1">Payout ratio over 1x means paying out more than revenue.</p>
                            </div>
                          </div>
                        </Card>
                      </div>
                    </div>
                  )}
                </div>
              )}

              {/* ============ USERS ============ */}
              {section === "Users" && (
                <div className="space-y-4">
                  <Card>
                    <div className="p-4 flex flex-col md:flex-row gap-3 md:items-center">
                      <div className="relative flex-1">
                        <span className="absolute left-3.5 top-1/2 -translate-y-1/2 text-white/30 text-sm">⌕</span>
                        <input value={userSearch} onChange={(e) => setUserSearch(e.target.value)} placeholder="Search ghost name or email…" className="w-full bg-black/40 border border-white/10 rounded-xl pl-10 pr-4 py-2.5 text-sm placeholder:text-white/25 focus:outline-none focus:border-[#baff39]/60" />
                      </div>
                      <div className="flex gap-1.5">
                        {["ALL", "FREE", "PLUS", "PRIME"].map((t) => (
                          <button key={t} onClick={() => setTierFilter(t)} className={`text-xs font-bold px-3.5 py-2 rounded-full border transition-colors ${tierFilter === t ? "bg-[#baff39] text-black border-[#baff39]" : "border-white/10 text-white/50 hover:text-white"}`}>{t === "ALL" ? "All" : t}</button>
                        ))}
                      </div>
                    </div>
                  </Card>

                  <Card>
                    <CardHeader title={`Users · ${filteredUsers.length}`} sub="Suspend is reversible · Ban is hard · Delete only works with zero posts" />
                    {filteredUsers.length === 0 ? (
                      <div className="p-6"><EmptyState icon="👻" title={userSearch ? "No ghosts match" : "Type to search users"} sub="Results limited to 30 most recent" /></div>
                    ) : (
                      <div className="overflow-x-auto">
                        <table className="w-full min-w-[720px]">
                          <thead><tr className="border-b border-white/[0.06]">{["Ghost", "Contact", "Campus", "Tier", "Actions"].map((h) => <th key={h} className={th}>{h}</th>)}</tr></thead>
                          <tbody>
                            {filteredUsers.map((u, i) => (
                              <tr key={u.id} className={`border-b border-white/[0.04] last:border-0 hover:bg-white/[0.03] transition-colors ${i % 2 === 1 ? "bg-white/[0.012]" : ""}`}>
                                <td className={td}><span className="font-bold text-white">{u.ghostId}</span><p className="text-[11px] font-mono text-white/20">{u.id.slice(0, 8)}…</p></td>
                                <td className={`${td} text-white/60 max-w-[220px] truncate`}>{u.email}</td>
                                <td className={`${td} text-white/60 whitespace-nowrap`}>{u.campus}</td>
                                <td className={td}><TierBadge tier={u.tier} /></td>
                                <td className={td}>
                                  <div className="flex gap-1.5 justify-end">
                                    <button disabled={!!busyId} onClick={() => handleUserAction(u.id, "suspend")} className="text-xs font-bold px-3 py-1.5 rounded-lg border border-white/10 text-white/60 hover:bg-white/5 disabled:opacity-40">Suspend</button>
                                    <button disabled={!!busyId} onClick={() => handleUserAction(u.id, "ban")} className="text-xs font-bold px-3 py-1.5 rounded-lg border border-red-500/30 bg-red-500/10 text-red-400 hover:bg-red-500/20 disabled:opacity-40">Ban</button>
                                    <button disabled={!!busyId} onClick={() => handleUserAction(u.id, "delete")} className="text-xs font-bold px-3 py-1.5 rounded-lg text-red-500/70 hover:bg-red-500/10 disabled:opacity-40">Delete</button>
                                  </div>
                                </td>
                              </tr>
                            ))}
                          </tbody>
                        </table>
                      </div>
                    )}
                  </Card>
                </div>
              )}

              {/* ============ POSTS ============ */}
              {section === "Posts" && (
                <div className="space-y-4">
                  <Card>
                    <div className="p-4">
                      <div className="relative">
                        <span className="absolute left-3.5 top-1/2 -translate-y-1/2 text-white/30 text-sm">⌕</span>
                        <input value={postSearch} onChange={(e) => setPostSearch(e.target.value)} placeholder="Search post text…" className="w-full bg-black/40 border border-white/10 rounded-xl pl-10 pr-4 py-2.5 text-sm placeholder:text-white/25 focus:outline-none focus:border-[#baff39]/60" />
                      </div>
                    </div>
                  </Card>
                  <Card>
                    <CardHeader title={`Posts · ${posts.length}`} sub="Debounced · 30 max" />
                    {posts.length === 0 ? (
                      <div className="p-6"><EmptyState icon="📝" title={postSearch ? "No posts match" : "Type to search posts"} sub="Results limited to 30 most recent" /></div>
                    ) : (
                      <div className="overflow-x-auto">
                        <table className="w-full min-w-[640px]">
                          <thead><tr className="border-b border-white/[0.06]">{["Post", "Author", "ID", "Action"].map((h) => <th key={h} className={th}>{h}</th>)}</tr></thead>
                          <tbody>
                            {posts.map((p, i) => (
                              <tr key={p.id} className={`border-b border-white/[0.04] last:border-0 hover:bg-white/[0.03] transition-colors ${i % 2 === 1 ? "bg-white/[0.012]" : ""}`}>
                                <td className={`${td} max-w-[420px]`}><span className="text-white/85 line-clamp-2">{p.text || "(image / voice post)"}</span></td>
                                <td className={`${td} font-semibold whitespace-nowrap`}>{p.user.ghostId}</td>
                                <td className={`${td} font-mono text-[11px] text-white/25`}>{p.id.slice(0, 8)}…</td>
                                <td className={td}><div className="flex justify-end"><button disabled={!!busyId} onClick={() => handleDeletePost(p.id)} className="text-xs font-bold px-3.5 py-1.5 rounded-lg bg-red-500 text-white hover:bg-red-400 disabled:opacity-40">Delete</button></div></td>
                              </tr>
                            ))}
                          </tbody>
                        </table>
                      </div>
                    )}
                  </Card>
                </div>
              )}

              {/* ============ REPORTS ============ */}
              {section === "Reports" && (
                <div className="space-y-3">
                  <div className="flex items-center justify-between">
                    <p className="text-sm text-white/40"><span className="text-white font-black">{reports.length}</span> open · AI verdict speeds triage</p>
                  </div>
                  {reports.length === 0 ? (
                    <EmptyState icon="✅" title="No open reports" sub="All clear. Community is healthy." />
                  ) : (
                    <div className="grid xl:grid-cols-2 gap-3">
                      {reports.map((r) => (
                        <Card key={r.id}>
                          <div className="p-4 sm:p-5">
                            <div className="flex items-center justify-between gap-2">
                              <p className="text-xs text-white/40">By <span className="text-white font-bold">{r.reporter.ghostId}</span> · <span className="font-mono">{r.id.slice(0, 8)}…</span></p>
                              {r.aiVerdict && <span className={`text-[10px] font-black px-2 py-1 rounded-full uppercase tracking-wide ${r.aiVerdict === "VIOLATION" ? "bg-red-500/15 text-red-400 border border-red-500/25" : "bg-[#baff39]/10 text-[#baff39] border border-[#baff39]/25"}`}>AI: {r.aiVerdict}</span>}
                            </div>
                            <p className="text-[13px] mt-2.5"><span className="text-white/35">Reason: </span><span className="font-semibold text-white">{r.reason}</span></p>
                            <p className="text-[13px] text-white/80 mt-2.5 p-3 rounded-xl bg-black/40 border border-white/[0.07] whitespace-pre-wrap line-clamp-4">{r.post?.text || "(no text / image post)"}</p>
                            <div className="flex gap-2 mt-3.5">
                              <button disabled={!!busyId} onClick={() => handleReportAction(r.id, "dismissed")} className="flex-1 rounded-xl border border-white/10 py-2.5 text-sm font-bold text-white/60 hover:bg-white/5 disabled:opacity-40">Dismiss</button>
                              <button disabled={!!busyId} onClick={() => handleReportAction(r.id, "actioned")} className="flex-1 rounded-xl bg-red-500 py-2.5 text-sm font-bold text-white hover:bg-red-400 disabled:opacity-40">{busyId === r.id ? "Working…" : "Remove post"}</button>
                            </div>
                          </div>
                        </Card>
                      ))}
                    </div>
                  )}
                </div>
              )}

              {/* ============ PAYOUTS ============ */}
              {section === "Payouts" && (
                <div className="space-y-4">
                  <div className="rounded-2xl border border-amber-500/25 bg-amber-500/[0.05] p-4">
                    <p className="text-xs font-black text-amber-300 uppercase tracking-wider">⚠️ Real money — check before approving</p>
                    <p className="text-xs text-white/50 mt-1.5 leading-relaxed">Verify Prime earnings + readable bank/MoMo details. Approve → Paystack transfer (needs balance). Status flows <span className="text-white/80 font-semibold">pending → approved → paid / rejected</span>. Failed transfers revert to pending.</p>
                  </div>

                  <Card>
                    <div className="p-4 flex flex-col sm:flex-row sm:items-center gap-3">
                      <div className="flex gap-1.5 bg-black/40 border border-white/10 rounded-xl p-1 w-fit">
                        {(["pending", "paid", "all"] as const).map((t) => (
                          <button key={t} onClick={() => setPayoutTab(t)} className={`text-xs font-bold px-4 py-2 rounded-lg capitalize transition-colors ${payoutTab === t ? "bg-[#baff39] text-black" : "text-white/50 hover:text-white"}`}>{t}</button>
                        ))}
                      </div>
                      <p className="text-xs text-white/35 sm:ml-auto">{payouts.length} result{payouts.length !== 1 ? "s" : ""} · Total <span className="text-white font-bold">{ghs(payouts.reduce((a, p) => a + p.amount, 0))}</span></p>
                    </div>
                  </Card>

                  {payouts.length === 0 ? (
                    <EmptyState icon="💸" title={`No ${payoutTab} payouts`} sub={payoutTab === "pending" ? "Approved / paid and failed are hidden under other tabs." : "Nothing here yet."} />
                  ) : (
                    <Card>
                      <div className="overflow-x-auto">
                        <table className="w-full min-w-[760px]">
                          <thead><tr className="border-b border-white/[0.06]">{["User", "Amount", "Recipient", "Status", "Action"].map((h) => <th key={h} className={th}>{h}</th>)}</tr></thead>
                          <tbody>
                            {payouts.map((p, i) => (
                              <tr key={p.id} className={`border-b border-white/[0.04] last:border-0 hover:bg-white/[0.03] ${i % 2 === 1 ? "bg-white/[0.012]" : ""}`}>
                                <td className={td}><p className="font-bold">{p.user.ghostId}</p><p className="text-[11px] text-white/30 truncate max-w-[200px]">{p.user.email}</p></td>
                                <td className={td}><span className="font-black text-[#baff39] whitespace-nowrap">{ghs(p.amount)}</span></td>
                                <td className={`${td} max-w-[260px]`}><p className="text-xs text-white/70 truncate">{p.accountName || "—"} · {p.accountNumber || "—"}</p><p className="text-[11px] font-mono text-white/30">{p.bankCode || "—"}</p></td>
                                <td className={td}><span className="text-[11px] font-bold px-2.5 py-1 rounded-full bg-white/[0.06] border border-white/10 text-white/60 uppercase">{p.status || payoutTab}</span></td>
                                <td className={td}>
                                  {(!p.status || p.status === "pending") ? (
                                    <button disabled={!!busyId} onClick={() => handleApprovePayout(p.id)} className="whitespace-nowrap text-xs font-black px-4 py-2 rounded-xl bg-[#baff39] text-black hover:bg-[#d4ff70] disabled:opacity-40 shadow-[0_0_20px_rgba(186,255,57,0.25)]">{busyId === p.id ? "Paying…" : "Approve & Pay"}</button>
                                  ) : <span className="text-xs text-white/25">—</span>}
                                </td>
                              </tr>
                            ))}
                          </tbody>
                        </table>
                      </div>
                    </Card>
                  )}
                </div>
              )}

              {/* ============ BATTLES ============ */}
              {section === "Battles" && (
                <div className="grid lg:grid-cols-5 gap-4">
                  <Card className="lg:col-span-3">
                    <CardHeader title="Create battle prompt" sub="Campus + prompt → ACTIVE for 7 days" />
                    <div className="p-5 space-y-3">
                      <input value={promptText} onChange={(e) => setPromptText(e.target.value)} placeholder="Prompt — e.g. Best jollof on campus?" className="w-full bg-black/40 border border-white/10 rounded-xl px-4 py-3 text-sm placeholder:text-white/25 focus:outline-none focus:border-[#baff39]/60" />
                      <select value={campus} onChange={(e) => setCampus(e.target.value)} className="w-full bg-black/40 border border-white/10 rounded-xl px-4 py-3 text-sm text-white focus:outline-none focus:border-[#baff39]/60">
                        <option value="">Select school</option>
                        {CAMPUSES.map((c) => <option key={c} value={c}>{c}</option>)}
                      </select>
                      <button disabled={busyId === "battle"} onClick={handleCreateBattle} className="w-full rounded-xl bg-[#baff39] text-black font-black py-3 text-sm hover:bg-[#d4ff70] disabled:opacity-50 transition-colors">{busyId === "battle" ? "Creating…" : "Create battle (7 days)"}</button>
                    </div>
                  </Card>
                  <Card className="lg:col-span-2">
                    <CardHeader title="API options" sub="Power fields" />
                    <div className="p-5">
                      <p className="text-xs text-white/40 leading-relaxed"><span className="text-white/70 font-mono">POST /api/admin/battles/create</span> accepts <span className="text-white/70 font-mono">type: SINGLE | BRACKET, totalRounds, entryType: TEXT | IMAGE | VOICE, isPrimeOnly, schedule, seasonId</span>.</p>
                      <div className="mt-4 grid grid-cols-2 gap-2 text-center">
                        {[["⚔", "Single"], ["🏆", "Bracket"], ["🖼", "Image"], ["🎙", "Voice"]].map(([i, l]) => (
                          <div key={l} className="rounded-xl border border-white/[0.07] bg-black/30 py-3"><p>{i}</p><p className="text-[11px] font-bold text-white/50 mt-1">{l}</p></div>
                        ))}
                      </div>
                    </div>
                  </Card>
                </div>
              )}

              {/* ============ SETTINGS ============ */}
              {section === "Settings" && <SettingsPanel />}

            </motion.div>
          </AnimatePresence>
        </main>

        <footer className="border-t border-white/[0.05] mt-auto">
          <div className="mx-auto max-w-[1240px] px-4 sm:px-6 lg:px-8 py-4 flex flex-col sm:flex-row items-center justify-between gap-1.5">
            <p className="text-[11px] text-white/25">Yard Admin · Be careful with money actions</p>
            <p className="text-[11px] text-white/25 font-mono">AuditLog · {stats?.userCount || 0} users · {stats?.postCount || 0} posts</p>
          </div>
        </footer>
      </div>
    </div>
  )
}

/* ===== SETTINGS (live server .env, masked) ===== */

type KeyState = { set: boolean; chars: number; prefix: string | null; mode: "test" | "live" | null }
type FlagState = { set: boolean; chars: number }

type EnvStatus = {
  source: string
  paystack: {
    publicKey: KeyState; secretKey: KeyState; webhookSecret: FlagState
    plusPlan: string | null; primePlan: string | null
    plusPricePesewas: number; primePricePesewas: number
  }
  security: { payoutEncryption: FlagState; jwt: FlagState; adminJwt: FlagState; cron: FlagState }
  services: { resend: FlagState; uploadthing: FlagState; openrouter: FlagState; firebase: FlagState; vapid: FlagState; database: FlagState }
  env: { nodeEnv: string; appUrl: string }
}

function SetPill({ ok, label }: { ok: boolean; label?: string }) {
  return (
    <span className={`text-[10px] font-black px-2 py-0.5 rounded-full uppercase tracking-wide ${ok ? "bg-[#baff39]/10 text-[#baff39] border border-[#baff39]/25" : "bg-red-500/15 text-red-400 border border-red-500/25"}`}>
      {label || (ok ? "set" : "missing")}
    </span>
  )
}

function SettingsPanel() {
  const [env, setEnv] = useState<EnvStatus | null>(null)
  const [err, setErr] = useState("")

  useEffect(() => {
    adminFetch("/api/admin/env-status")
      .then((d) => setEnv(d as unknown as EnvStatus))
      .catch((e: unknown) => setErr(e instanceof Error ? e.message : "Failed to load settings"))
  }, [])

  if (err) return <EmptyState icon="⚙" title="Settings unavailable" sub={err} />
  if (!env) {
    return (
      <div className="grid md:grid-cols-3 gap-4">
        {[0, 1, 2].map((i) => <div key={i} className="h-[240px] rounded-2xl skeleton-shimmer" />)}
      </div>
    )
  }

  const keyVal = (k: KeyState) =>
    k.set ? `${k.prefix || "••••"}… (${k.chars} chars)` : "not set"

  return (
    <div className="space-y-4">
      <p className="text-xs text-white/35">Source: <span className="text-white/70 font-mono font-bold">{env.source}</span> · secrets masked — full values never leave the server.</p>
      <div className="grid md:grid-cols-3 gap-4">
        <Card>
          <CardHeader title="Paystack" sub="Real money keys" right={
            env.paystack.secretKey.mode
              ? <span className={`text-[10px] font-black px-2 py-1 rounded-full uppercase ${env.paystack.secretKey.mode === "test" ? "bg-amber-500/15 text-amber-300 border border-amber-500/25" : "bg-red-500/15 text-red-400 border border-red-500/25"}`}>{env.paystack.secretKey.mode}</span>
              : <SetPill ok={false} />
          } />
          <div className="p-4 space-y-2">
            {[["Public key", keyVal(env.paystack.publicKey), env.paystack.publicKey.set],
              ["Secret key", keyVal(env.paystack.secretKey), env.paystack.secretKey.set],
              ["Webhook secret", env.paystack.webhookSecret.set ? `set (${env.paystack.webhookSecret.chars} chars)` : "not set", env.paystack.webhookSecret.set],
              ["Plus plan", env.paystack.plusPlan || "not set", !!env.paystack.plusPlan],
              ["Prime plan", env.paystack.primePlan || "not set", !!env.paystack.primePlan],
              ["Plus price", ghs(env.paystack.plusPricePesewas), true],
              ["Prime price", ghs(env.paystack.primePricePesewas), true],
            ].map(([k, v, ok]) => (
              <div key={k as string} className="rounded-xl bg-black/30 border border-white/[0.06] px-3 py-2.5 flex items-center justify-between gap-2">
                <span className="text-[11px] font-bold text-white/35 uppercase tracking-wide">{k}</span>
                <span className="flex items-center gap-2"><span className="text-xs font-mono text-white/70">{v}</span><SetPill ok={!!ok} /></span>
              </div>
            ))}
            <p className="text-[11px] text-amber-300/70 pt-1">Keys move real money. Rotate quarterly.</p>
          </div>
        </Card>

        <Card>
          <CardHeader title="Security" sub="Auth & encryption" />
          <div className="p-4 space-y-2">
            {[["PAYOUT_ENCRYPTION_KEY", env.security.payoutEncryption.set],
              ["JWT_SECRET", env.security.jwt.set],
              ["ADMIN_JWT_SECRET", env.security.adminJwt.set],
              ["CRON_SECRET", env.security.cron.set],
            ].map(([k, ok]) => (
              <div key={k as string} className="rounded-xl bg-black/30 border border-white/[0.06] px-3 py-2.5 flex items-center justify-between gap-2">
                <span className="text-[11px] font-bold text-white/35 uppercase tracking-wide">{k}</span>
                <SetPill ok={!!ok} />
              </div>
            ))}
            <div className="rounded-xl bg-black/30 border border-white/[0.06] px-3 py-2.5 flex items-center justify-between gap-2">
              <span className="text-[11px] font-bold text-white/35 uppercase tracking-wide">Algorithm</span>
              <span className="text-xs font-mono text-white/70">AES-256-GCM</span>
            </div>
            <p className="text-[11px] text-amber-300/70 pt-1">Encrypts bank / MoMo details at rest.</p>
          </div>
        </Card>

        <Card>
          <CardHeader title="Services & env" sub="Integrations" />
          <div className="p-4 space-y-2">
            {[["Resend (email)", env.services.resend.set],
              ["UploadThing", env.services.uploadthing.set],
              ["OpenRouter (AI)", env.services.openrouter.set],
              ["Firebase (push)", env.services.firebase.set],
              ["VAPID (web push)", env.services.vapid.set],
              ["Database", env.services.database.set],
            ].map(([k, ok]) => (
              <div key={k as string} className="rounded-xl bg-black/30 border border-white/[0.06] px-3 py-2.5 flex items-center justify-between gap-2">
                <span className="text-[11px] font-bold text-white/35 uppercase tracking-wide">{k}</span>
                <SetPill ok={!!ok} />
              </div>
            ))}
            <div className="rounded-xl bg-black/30 border border-white/[0.06] px-3 py-2.5 flex items-center justify-between gap-2">
              <span className="text-[11px] font-bold text-white/35 uppercase tracking-wide">NODE_ENV</span>
              <span className="text-xs font-mono text-white/70">{env.env.nodeEnv}</span>
            </div>
            <div className="rounded-xl bg-black/30 border border-white/[0.06] px-3 py-2.5 flex items-center justify-between gap-2">
              <span className="text-[11px] font-bold text-white/35 uppercase tracking-wide">APP_URL</span>
              <span className="text-xs font-mono text-white/70 truncate max-w-[160px]">{env.env.appUrl}</span>
            </div>
          </div>
        </Card>
      </div>
    </div>
  )
}
