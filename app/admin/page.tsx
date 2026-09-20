"use client"

import { useCallback, useEffect, useRef, useState } from "react"
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
  accountName: string | null
  accountNumber: string | null
  bankCode: string | null
  user: { ghostId: string; email: string }
}

type AdminUser = { id: string; ghostId: string; email: string; campus: string; tier: string }
type AdminPost = { id: string; text: string | null; user: { ghostId: string } }

type SectionKey = "Overview" | "Reports" | "Payouts" | "Users" | "Posts" | "Battles" | "Settings"

const NAV_GROUPS: { label: string; items: { key: SectionKey; label: string; icon: string; desc: string }[] }[] = [
  { label: "Dashboard", items: [{ key: "Overview", label: "Overview", icon: "✦", desc: "Revenue & health" }] },
  { label: "Moderation", items: [{ key: "Reports", label: "Reports", icon: "◈", desc: "Flagged posts" }] },
  { label: "Money", items: [{ key: "Payouts", label: "Payouts", icon: "◉", desc: "Creator payments" }] },
  { label: "Content", items: [
    { key: "Users", label: "Users", icon: "⬡", desc: "Search & manage" },
    { key: "Posts", label: "Posts", icon: "⬢", desc: "Search & delete" },
  ]},
  { label: "Engagement", items: [{ key: "Battles", label: "Battles", icon: "⚔", desc: "Create prompts" }] },
  { label: "Settings", items: [{ key: "Settings", label: "Settings", icon: "⚙", desc: "Keys & config" }] },
]

const MOBILE_TABS: { key: SectionKey; label: string; icon: string }[] = [
  { key: "Overview", label: "Overview", icon: "✦" },
  { key: "Reports", label: "Reports", icon: "◈" },
  { key: "Payouts", label: "Payouts", icon: "◉" },
  { key: "Users", label: "Users", icon: "⬡" },
  { key: "Battles", label: "Battles", icon: "⚔" },
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

function AnimatedNumber({ value, className = "", duration = 0.6 }: { value: number; className?: string; duration?: number }) {
  const [display, setDisplay] = useState(0)
  useEffect(() => {
    let start = 0
    const step = (timestamp: number) => {
      if (!start) start = timestamp
      const progress = Math.min((timestamp - start) / (duration * 1000), 1)
      const eased = 1 - Math.pow(1 - progress, 3)
      setDisplay(Math.round(eased * value))
      if (progress < 1) requestAnimationFrame(step)
    }
    requestAnimationFrame(step)
  }, [value, duration])
  return <span className={className}>{display.toLocaleString()}</span>
}

function NavButton({ active, icon, label, count, onClick, desc }: { active: boolean; icon: string; label: string; count?: number | null; onClick: () => void; desc?: string }) {
  return (
    <button
      onClick={onClick}
      aria-current={active ? "page" : undefined}
      className={`w-full flex items-center gap-3 px-3 py-2.5 rounded-xl border text-left transition-all focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#baff39] group relative ${
        active ? "border-l-2 border-[#baff39] bg-transparent text-[#baff39]" : "border-transparent text-white/60 hover:bg-white/[0.04] hover:text-white/90"
      }`}
    >
      <span className={`w-8 h-8 rounded-lg flex items-center justify-center text-sm flex-shrink-0 transition-all ${active ? "bg-[#baff39]/20" : "bg-white/[0.06] group-hover:bg-white/[0.1]"}`} aria-hidden>{icon}</span>
      <span className="flex-1 min-w-0">
        <span className="block text-sm font-medium leading-none">{label}</span>
        {desc && <span className={`block text-[11px] mt-0.5 ${active ? "text-[#baff39]/70" : "text-white/30"}`}>{desc}</span>}
      </span>
      {typeof count === "number" && count > 0 && (
        <motion.span
          initial={{ scale: 0 }}
          animate={{ scale: 1 }}
          className={`text-[11px] font-bold px-2 py-1 rounded-full flex-shrink-0 ${active ? "bg-[#baff39] text-black" : "bg-white/10 text-white/70"}`}
        >{count > 99 ? "99+" : count}</motion.span>
      )}
    </button>
  )
}

function StatCard({ icon, label, value, sub, accent = "#baff39", delay = 0 }: { icon: string; label: string; value: string | number; sub: string; accent?: string; delay?: number }) {
  return (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ delay }}
      className="card p-4 hover:border-white/20 transition-all group"
      style={{ borderColor: `${accent}20` }}
    >
      <div className="flex items-center gap-2 mb-2">
        <span className="w-7 h-7 rounded-lg flex items-center justify-center text-xs" style={{ background: `${accent}15`, border: `1px solid ${accent}30` }}>{icon}</span>
        <p className="text-[11px] text-white/40 font-medium uppercase tracking-wider">{label}</p>
      </div>
      <p className="text-2xl font-black tracking-tight" style={{ color: accent }}><AnimatedNumber value={typeof value === "number" ? value : 0} /></p>
      <p className="text-[11px] text-white/30 mt-0.5">{sub}</p>
    </motion.div>
  )
}

export default function AdminPage() {
  const router = useRouter()
  const mainRef = useRef<HTMLDivElement>(null)
  const [section, setSection] = useState<SectionKey>("Overview")
  const [mobileOpen, setMobileOpen] = useState(false)
  const [notAllowed, setNotAllowed] = useState(false)
  const [loading, setLoading] = useState(true)
  const [mobileTab, setMobileTab] = useState<SectionKey>("Overview")
  const [isRefreshing, setIsRefreshing] = useState(false)
  const [denseMode, setDenseMode] = useState(() => {
    if (typeof window !== "undefined") return localStorage.getItem("admin-dense") === "true"
    return false
  })
  const [showShortcuts, setShowShortcuts] = useState(false)
  const [showCommandPalette, setShowCommandPalette] = useState(false)
  const [keySequence, setKeySequence] = useState("")

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

  // Dense mode persistence
  useEffect(() => {
    localStorage.setItem("admin-dense", String(denseMode))
    document.documentElement.classList.toggle("admin-dense", denseMode)
  }, [denseMode])

  // Keyboard shortcuts
  useEffect(() => {
    function handleKeyDown(e: KeyboardEvent) {
      // Don't trigger shortcuts when typing in inputs
      if (e.target instanceof HTMLInputElement || e.target instanceof HTMLTextAreaElement || e.target instanceof HTMLSelectElement) {
        if (e.key === "Escape") {
          ;(e.target as HTMLElement).blur()
        }
        return
      }

      // Show shortcuts help
      if (e.key === "?") {
        e.preventDefault()
        setShowShortcuts(true)
        return
      }

      // Command palette
      if ((e.metaKey || e.ctrlKey) && e.key === "k") {
        e.preventDefault()
        setShowCommandPalette(true)
        return
      }

      // Escape closes modals
      if (e.key === "Escape") {
        setShowShortcuts(false)
        setShowCommandPalette(false)
        setMobileOpen(false)
        return
      }

      // Goto shortcuts (g + key)
      if (keySequence === "g") {
        const shortcuts: Record<string, SectionKey> = {
          o: "Overview",
          r: "Reports",
          p: "Payouts",
          u: "Users",
          P: "Posts",
          b: "Battles",
          s: "Settings",
        }
        if (shortcuts[e.key]) {
          e.preventDefault()
          handleSectionChange(shortcuts[e.key])
          setKeySequence("")
          return
        }
      }

      // Single key shortcuts
      switch (e.key) {
        case "r":
          handleRefresh()
          break
        case "/":
          e.preventDefault()
          // Focus appropriate search
          if (section === "Users") {
            ;(document.getElementById("user-search") as HTMLInputElement)?.focus()
          } else if (section === "Posts") {
            ;(document.getElementById("post-search") as HTMLInputElement)?.focus()
          } else if (section === "Battles") {
            ;(document.getElementById("battle-prompt") as HTMLInputElement)?.focus()
          }
          break
        case "n":
          if (section === "Battles") {
            ;(document.getElementById("battle-prompt") as HTMLInputElement)?.focus()
          }
          break
        case "d":
          if (e.metaKey || e.ctrlKey) {
            e.preventDefault()
            setDenseMode(!denseMode)
          }
          break
        case "g":
          setKeySequence("g")
          setTimeout(() => setKeySequence(""), 1000)
          break
      }
    }

    window.addEventListener("keydown", handleKeyDown)
    return () => window.removeEventListener("keydown", handleKeyDown)
  }, [section, denseMode, keySequence])

  const handleRefresh = useCallback(async () => {
    setIsRefreshing(true)
    await loadAll()
    setIsRefreshing(false)
  }, [loadAll])

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
        body: JSON.stringify({ text: promptText, campus, durationHours: 24 }),
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
      loadAll()
    } catch (e: any) { alert(e.message || "Delete failed.") }
    finally { setBusyId(null) }
  }

  function handleSectionChange(s: SectionKey) {
    setSection(s)
    setMobileTab(s)
    setMobileOpen(false)
  }

  // Command Palette items
  const commandItems = [
    { label: "Overview", action: () => handleSectionChange("Overview"), shortcut: "g o", section: "Dashboard" },
    { label: "Reports", action: () => handleSectionChange("Reports"), shortcut: "g r", section: "Moderation" },
    { label: "Payouts", action: () => handleSectionChange("Payouts"), shortcut: "g p", section: "Money" },
    { label: "Users", action: () => handleSectionChange("Users"), shortcut: "g u", section: "Content" },
    { label: "Posts", action: () => handleSectionChange("Posts"), shortcut: "g P", section: "Content" },
    { label: "Battles", action: () => handleSectionChange("Battles"), shortcut: "g b", section: "Engagement" },
    { label: "Settings", action: () => handleSectionChange("Settings"), shortcut: "g s", section: "Settings" },
    { label: "Refresh Data", action: handleRefresh, shortcut: "r", section: "Actions" },
    { label: "Toggle Dense Mode", action: () => setDenseMode(!denseMode), shortcut: "⌘D", section: "View" },
    { label: "Show Shortcuts", action: () => setShowShortcuts(true), shortcut: "?", section: "Help" },
  ]

  // Filter command items based on input
  const [commandFilter, setCommandFilter] = useState("")
  const filteredCommands = commandItems.filter((item) =>
    item.label.toLowerCase().includes(commandFilter.toLowerCase()) ||
    item.shortcut.toLowerCase().includes(commandFilter.toLowerCase()) ||
    item.section.toLowerCase().includes(commandFilter.toLowerCase())
  )

  if (notAllowed) return null
  if (loading) return <p className="text-center text-white/40 mt-20">Loading admin…</p>

  const freeCount = Math.max(0, stats ? stats.userCount - stats.primeCount - stats.plusCount : 0)
  const total = Math.max(1, stats?.userCount || 1)
  const tierData = [
    { name: "Prime", value: stats?.primeCount || 0, color: "#facc15" },
    { name: "Plus", value: stats?.plusCount || 0, color: "#38bdf8" },
    { name: "Free", value: freeCount, color: "#baff39" },
  ]

  const activeSection = section

  return (
    <div className="min-h-screen bg-[#050505] flex flex-col relative overflow-hidden">
      {/* Animated background grid */}
      <div className="fixed inset-0 pointer-events-none opacity-[0.03]" aria-hidden="true">
        <div className="absolute inset-0 bg-[radial-gradient(circle_at_50%_0%,_rgba(186,255,57,0.08),_transparent_60%)]" />
        <div className="absolute inset-0 bg-[linear-gradient(to_right,_rgba(255,255,255,0.02)_1px,_transparent_1px),_linear-gradient(to_bottom,_rgba(255,255,255,0.02)_1px,_transparent_1px)] bg-[size:60px_60px]" />
      </div>

      {/* Glow */}
      <div className="fixed top-[-200px] left-1/2 -translate-x-1/2 w-[600px] h-[400px] bg-[#baff39]/[0.04] rounded-full blur-[120px] pointer-events-none" aria-hidden="true" />

      {/* Desktop sidebar */}
      <aside className="hidden md:flex w-[260px] shrink-0 sticky top-0 h-screen border-r border-white/[0.06] bg-[#080808]/80 backdrop-blur-xl flex-col z-20">
        {/* Sidebar header */}
        <motion.div
          initial={{ opacity: 0, x: -20 }}
          animate={{ opacity: 1, x: 0 }}
          transition={{ duration: 0.5 }}
          className="px-5 py-6 border-b border-white/[0.06]"
        >
          <div className="flex items-center gap-3">
            <div className="relative">
              <span className="font-black text-xl tracking-tight">YARD<span className="text-[#baff39]">.</span></span>
              <div className="absolute -top-1 -right-1 w-2 h-2 rounded-full bg-[#baff39] animate-pulse" />
            </div>
            <span className="text-[10px] font-bold tracking-widest text-white/30 border border-white/10 rounded-full px-2 py-0.5">ADMIN</span>
          </div>
          <p className="text-xs text-white/30 mt-2 flex items-center gap-1.5">
            <span className="w-1.5 h-1.5 rounded-full bg-[#baff39] animate-pulse" />
            Control Center · Ghana campuses
          </p>
        </motion.div>

        {/* Tier stats with chart */}
        <motion.div
          initial={{ opacity: 0, x: -20 }}
          animate={{ opacity: 1, x: 0 }}
          transition={{ delay: 0.1, duration: 0.5 }}
          className="px-4 pt-4 space-y-3"
        >
          <div className="card p-3 border-[#facc15]/15 bg-[#facc15]/[0.04]">
            <div className="flex items-center justify-between mb-2">
              <div className="flex items-center gap-2">
                <span className="w-7 h-7 rounded-lg bg-[#facc15]/15 border border-[#facc15]/20 grid place-items-center text-xs">👑</span>
                <div>
                  <p className="text-[11px] font-black text-[#facc15]">Prime</p>
                  <p className="text-[10px] text-white/30">GHS 20/mo · auto</p>
                </div>
              </div>
              <span className="text-lg font-black text-[#facc15]">{stats?.primeCount || 0}</span>
            </div>
            <div className="h-1.5 rounded-full bg-black/30 overflow-hidden">
              <motion.div
                className="h-full bg-gradient-to-r from-[#facc15] to-[#facc15]/80 rounded-full"
                initial={{ width: 0 }}
                animate={{ width: `${Math.round((stats?.primeCount || 0) / total * 100)}%` }}
                transition={{ delay: 0.3, duration: 0.8, ease: "easeOut" }}
              />
            </div>
            <div className="flex justify-between mt-1.5">
              <p className="text-[10px] text-white/30">{Math.round((stats?.primeCount || 0) / total * 100)}% of users</p>
              <p className="text-[10px] text-[#facc15]/60">{ghs(stats?.primeCount ? stats.primeCount * 2000 : 0)}</p>
            </div>
          </div>

          <div className="card p-3 border-sky-500/15 bg-sky-500/[0.04]">
            <div className="flex items-center justify-between mb-2">
              <div className="flex items-center gap-2">
                <span className="w-7 h-7 rounded-lg bg-sky-500/10 border border-sky-500/20 grid place-items-center text-xs">⭐</span>
                <div>
                  <p className="text-[11px] font-black text-sky-300">Plus</p>
                  <p className="text-[10px] text-white/30">GHS 10/mo · upgrade</p>
                </div>
              </div>
              <span className="text-lg font-black text-sky-300">{stats?.plusCount || 0}</span>
            </div>
            <div className="h-1.5 rounded-full bg-black/30 overflow-hidden">
              <motion.div
                className="h-full bg-gradient-to-r from-sky-500 to-sky-400 rounded-full"
                initial={{ width: 0 }}
                animate={{ width: `${Math.round((stats?.plusCount || 0) / total * 100)}%` }}
                transition={{ delay: 0.4, duration: 0.8, ease: "easeOut" }}
              />
            </div>
            <div className="flex justify-between mt-1.5">
              <p className="text-[10px] text-white/30">{Math.round((stats?.plusCount || 0) / total * 100)}% of users</p>
              <p className="text-[10px] text-sky-300/60">Push to Prime →</p>
            </div>
          </div>

          <div className="card p-3 border-white/10 bg-white/[0.02]">
            <div className="flex items-center justify-between mb-2">
              <div className="flex items-center gap-2">
                <span className="w-7 h-7 rounded-lg bg-white/5 border border-white/10 grid place-items-center text-xs">👻</span>
                <div>
                  <p className="text-[11px] font-black text-white/80">Free</p>
                  <p className="text-[10px] text-white/30">Potential · convert</p>
                </div>
              </div>
              <span className="text-lg font-black text-white/80">{freeCount}</span>
            </div>
            <div className="h-1.5 rounded-full bg-black/30 overflow-hidden">
              <motion.div
                className="h-full bg-gradient-to-r from-white/30 to-white/20 rounded-full"
                initial={{ width: 0 }}
                animate={{ width: `${Math.round(freeCount / total * 100)}%` }}
                transition={{ delay: 0.5, duration: 0.8, ease: "easeOut" }}
              />
            </div>
            <div className="flex justify-between mt-1.5">
              <p className="text-[10px] text-white/25">{Math.round(freeCount / total * 100)}% of users</p>
              <p className="text-[10px] text-white/25">{freeCount > 0 ? `${freeCount} to upsell` : "All converted!"}</p>
            </div>
          </div>

          <div className="flex items-center justify-between px-1 text-[11px] text-white/25 py-2 border-t border-white/[0.04]">
            <span>{stats?.userCount} total · {stats?.activeUsers} active 7d</span>
            <span className="font-mono text-[#baff39]/80 font-bold">{ghs(stats?.revenuePesewas || 0)}</span>
          </div>
        </motion.div>

        {/* Navigation */}
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ delay: 0.2, duration: 0.5 }}
          className="flex-1 overflow-y-auto p-3 space-y-6 no-scrollbar"
        >
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
        </motion.div>

        {/* Sidebar footer */}
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ delay: 0.3, duration: 0.5 }}
          className="p-3 border-t border-white/[0.06]"
        >
          <button onClick={() => router.push("/feed")} className="btn-ghost w-full text-sm flex items-center justify-center gap-2">
            <span>←</span> Back to Yard
          </button>
          <p className="text-[11px] text-white/20 text-center mt-2 flex items-center justify-center gap-1">
            <span className="w-1 h-1 rounded-full bg-[#baff39] animate-pulse" />
            Keys handle real money
          </p>
        </motion.div>
      </aside>

      {/* Mobile drawer */}
      <AnimatePresence>
        {mobileOpen && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.2 }}
            className="fixed inset-0 z-50 md:hidden"
          >
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              className="absolute inset-0 bg-black/70 backdrop-blur-sm"
              onClick={() => { setMobileOpen(false); setSection(activeSection) }}
            />
            <motion.div
              initial={{ x: -300 }}
              animate={{ x: 0 }}
              exit={{ x: -300 }}
              transition={{ type: "spring", damping: 25, stiffness: 200 }}
              className="absolute left-0 top-0 bottom-0 w-[300px] bg-[#0a0a0a]/95 backdrop-blur-xl border-r border-white/10 flex flex-col overflow-hidden"
            >
              <div className="px-5 py-5 border-b border-white/10 flex items-center justify-between">
                <div>
                  <span className="font-black text-lg">YARD<span className="text-[#baff39]">.</span></span>
                  <span className="text-[10px] tracking-widest text-white/30 ml-2">ADMIN</span>
                </div>
                <button onClick={() => setMobileOpen(false)} className="w-8 h-8 rounded-full bg-white/5 grid place-items-center text-white/60 hover:bg-white/10 transition-colors">✕</button>
              </div>
              <div className="px-3 pt-3 space-y-2">
                {stats && (
                  <>
                    <div className="card p-2.5 border-[#facc15]/20 bg-[#facc15]/[0.06] flex items-center justify-between">
                      <span className="text-xs font-bold text-[#facc15]">👑 Prime · {stats.primeCount}</span>
                      <span className="text-[10px] text-white/30">GHS 20</span>
                    </div>
                    <div className="card p-2.5 border-sky-500/20 bg-sky-500/[0.06] flex items-center justify-between">
                      <span className="text-xs font-bold text-sky-300">⭐ Plus · {stats.plusCount}</span>
                      <span className="text-[10px] text-white/30">GHS 10</span>
                    </div>
                    <div className="card p-2.5 border-white/10 bg-white/[0.03] flex items-center justify-between">
                      <span className="text-xs font-bold text-white/70">👻 Free · {freeCount}</span>
                      <span className="text-[10px] text-white/30">to convert</span>
                    </div>
                  </>
                )}
              </div>
              <div className="flex-1 overflow-y-auto p-3 space-y-6 pb-24">
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
              <div className="p-3 border-t border-white/10">
                <button onClick={() => { router.push("/feed"); setMobileOpen(false) }} className="btn-ghost w-full text-sm">← Back to Yard</button>
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Main column */}
      <div className="flex-1 min-w-0 flex flex-col">
        {/* Mobile header */}
        <header className="md:hidden sticky top-0 z-30 bg-[#0a0a0a]/90 backdrop-blur-xl border-b border-white/10 flex items-center gap-3 px-4 py-3">
          <button onClick={() => setMobileOpen(true)} aria-label="Open navigation" className="w-10 h-10 rounded-xl bg-white/5 border border-white/10 grid place-items-center text-white/80 hover:bg-white/10 transition-colors active:scale-95">
            <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round">
              <line x1="3" y1="6" x2="21" y2="6" /><line x1="3" y1="12" x2="21" y2="12" /><line x1="3" y1="18" x2="21" y2="18" />
            </svg>
          </button>
          <div className="flex-1 min-w-0">
            <p className="font-black leading-none text-sm">YARD<span className="text-[#baff39]">.</span> <span className="text-white/40 text-sm font-bold ml-1">{section}</span></p>
            <p className="text-[11px] text-white/30 truncate">{NAV_GROUPS.flatMap(g => g.items).find(i => i.key === section)?.desc}</p>
          </div>
          <div className="flex items-center gap-1">
            <span className="w-2 h-2 rounded-full bg-[#baff39] animate-pulse" />
          </div>
        </header>

        {/* Desktop top bar */}
        <div className="hidden md:flex items-center justify-between h-16 px-8 border-b border-white/[0.06] bg-[#080808]/30 backdrop-blur-sm">
          <div className="flex items-center gap-4">
            <span className={`w-9 h-9 rounded-xl grid place-items-center text-lg border flex-shrink-0 ${section === "Reports" ? "bg-red-500/10 border-red-500/20 text-red-400" : section === "Payouts" ? "bg-emerald-500/10 border-emerald-500/20 text-emerald-400" : "bg-white/5 border-white/10 text-white/70"}`}>
              {NAV_GROUPS.flatMap(g => g.items).find(i => i.key === section)?.icon}
            </span>
            <div className="min-w-0">
              <h1 className="text-2xl font-black tracking-tight truncate">{section}</h1>
              <p className="text-sm text-white/35 mt-0.5 truncate">{NAV_GROUPS.flatMap(g => g.items).find(i => i.key === section)?.desc}</p>
            </div>
          </div>
          <div className="flex items-center gap-3">
            {section === "Reports" && (
              <motion.span
                initial={{ scale: 0.8, opacity: 0 }}
                animate={{ scale: 1, opacity: 1 }}
                className="flex items-center gap-1.5 text-xs font-bold px-3 py-1.5 rounded-full bg-red-500/10 text-red-400 border border-red-500/20"
              >
                {reports.length > 0 && (
                  <motion.span
                    className="w-1.5 h-1.5 rounded-full bg-red-400"
                    animate={{ scale: [1, 1.3, 1] }}
                    transition={{ duration: 1.5, repeat: Infinity, ease: "easeInOut" }}
                  />
                )}
                {reports.length} open
              </motion.span>
            )}
            {section === "Payouts" && (
              <motion.span
                initial={{ scale: 0.8, opacity: 0 }}
                animate={{ scale: 1, opacity: 1 }}
                className="text-xs font-bold px-3 py-1.5 rounded-full bg-emerald-500/10 text-emerald-400 border border-emerald-500/20"
              >
                {payouts.length} pending
              </motion.span>
            )}
            <button onClick={handleRefresh} disabled={isRefreshing} className="btn-ghost text-sm flex items-center gap-2 disabled:opacity-50">
              <motion.svg
                width="14"
                height="14"
                viewBox="0 0 24 24"
                fill="none"
                stroke="currentColor"
                strokeWidth="2"
                className="transition-transform duration-300 hover:rotate-180"
                animate={isRefreshing ? { rotate: 360 } : {}}
                transition={{ duration: 1, repeat: isRefreshing ? Infinity : 0, ease: "linear" }}
              >
                <path d="M21 2v6h-6" /><path d="M3 12a9 9 0 0 1 15-6.7L21 8" /><path d="M3 22v-6h6" /><path d="M21 12a9 9 0 0 1-15 6.7L3 16" />
              </motion.svg>
              {isRefreshing ? "Refreshing..." : "Refresh"}
            </button>
          </div>
        </div>

        {/* Content area */}
        <main className="flex-1 px-4 md:px-8 py-6 w-full relative z-10" ref={mainRef}>
          <AnimatePresence mode="wait">
            <motion.div
              key={section}
              initial={{ opacity: 0, y: 16 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -16 }}
              transition={{ duration: 0.3, ease: "easeInOut" }}
            >
              {/* Pull to refresh indicator (mobile) */}
              {isRefreshing && (
                <div className="md:hidden fixed top-16 left-1/2 -translate-x-1/2 z-50 flex items-center gap-2 px-4 py-2 bg-[#0a0a0a]/95 backdrop-blur-xl border border-white/10 rounded-full shadow-lg">
                  <motion.div className="w-4 h-4 border-2 border-[#baff39] border-t-transparent rounded-full animate-spin" />
                  <span className="text-sm font-medium text-[#baff39]">Refreshing...</span>
                </div>
              )}
              {/* ===== OVERVIEW ===== */}
              {section === "Overview" && stats && (
                <div className="space-y-4 md:space-y-6">
                  {/* Hero revenue card */}
                  <motion.div
                    initial={{ opacity: 0, scale: 0.98 }}
                    animate={{ opacity: 1, scale: 1 }}
                    className="relative overflow-hidden card p-5 md:p-8 border-[#baff39]/20"
                    style={{ background: "linear-gradient(135deg, rgba(186,255,57,0.08) 0%, rgba(186,255,57,0.02) 50%, rgba(186,255,57,0.04) 100%)" }}
                  >
                    <div className="absolute top-0 right-0 w-40 h-40 bg-[#baff39]/[0.06] rounded-full blur-[60px]" aria-hidden="true" />
                    <div className="relative">
                      <p className="text-xs text-white/50 uppercase tracking-[0.12em] font-bold">Total Revenue</p>
                      <div className="flex items-end gap-3 mt-2">
                        <p className="text-4xl md:text-5xl font-black text-[#baff39] tracking-tight">{ghs(stats.revenuePesewas)}</p>
                        <span className="text-xs text-[#baff39]/60 mb-1 flex items-center gap-1">
                          <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5"><path d="M12 19V5M5 12l7-7 7 7" /></svg>
                          confirmed
                        </span>
                      </div>
                      <p className="text-xs text-white/30 mt-2">Sum of Transaction amount where status=success. Check Paystack if this looks low.</p>
                    </div>
                  </motion.div>

                  {/* Stat grid - stacked on mobile, grid on desktop */}
                  <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3">
                    <StatCard icon="👥" label="Users" value={stats.userCount} sub="total registered" accent="#baff39" delay={0.1} />
                    <StatCard icon="⚡" label="Active 7d" value={stats.activeUsers} sub="post/comment/vote" accent="#38bdf8" delay={0.2} />
                    <StatCard icon="📝" label="Posts" value={stats.postCount} sub="total" accent="#facc15" delay={0.3} />
                    <StatCard icon="💎" label="Paid Tiers" value={`${stats.primeCount}/${stats.plusCount}`} sub="Prime / Plus" accent="#facc15" delay={0.4} />
                  </div>

                  {/* Tier distribution chart + Payouts */}
                  <div className="grid grid-cols-1 gap-3 md:grid-cols-2">
                    <motion.div
                      initial={{ opacity: 0, y: 20 }}
                      animate={{ opacity: 1, y: 0 }}
                      transition={{ delay: 0.5 }}
                      className="card p-5"
                    >
                      <p className="text-xs text-white/50 uppercase tracking-widest font-bold mb-4">Tier Distribution</p>
                      <div className="h-[160px]">
                        <ResponsiveContainer width="100%" height="100%">
                          <BarChart data={tierData} margin={{ top: 5, right: 5, left: -20, bottom: 0 }}>
                            <XAxis dataKey="name" tick={{ fill: "rgba(255,255,255,0.3)", fontSize: 11 }} axisLine={false} tickLine={false} />
                            <YAxis tick={{ fill: "rgba(255,255,255,0.3)", fontSize: 11 }} axisLine={false} tickLine={false} />
                            <Tooltip
                              contentStyle={{ background: "#0a0a0a", border: "1px solid rgba(255,255,255,0.1)", borderRadius: "12px", color: "#fff", fontSize: "12px" }}
                            />
                            <Bar dataKey="value" radius={[6, 6, 0, 0]}>
                              {tierData.map((entry, index) => (
                                <Cell key={`cell-${index}`} fill={entry.color} />
                              ))}
                            </Bar>
                          </BarChart>
                        </ResponsiveContainer>
                      </div>
                      <div className="flex justify-center gap-4 mt-2">
                        {tierData.map((d, i) => (
                          <div key={i} className="flex items-center gap-1.5">
                            <span className="w-2 h-2 rounded-full" style={{ background: d.color }} />
                            <span className="text-[10px] text-white/40">{d.name}</span>
                          </div>
                        ))}
                      </div>
                    </motion.div>

                    <div className="space-y-3">
                      <motion.div
                        initial={{ opacity: 0, y: 20 }}
                        animate={{ opacity: 1, y: 0 }}
                        transition={{ delay: 0.6 }}
                        className="card p-4 flex items-center justify-between"
                      >
                        <div>
                          <p className="text-xs text-white/40">Pending payouts</p>
                          <p className="text-xl font-black mt-1 text-amber-400">{ghs(stats.pendingPayoutPesewas)}</p>
                        </div>
                        <span className="text-2xl opacity-30">⏳</span>
                      </motion.div>
                      <motion.div
                        initial={{ opacity: 0, y: 20 }}
                        animate={{ opacity: 1, y: 0 }}
                        transition={{ delay: 0.7 }}
                        className="card p-4 flex items-center justify-between"
                      >
                        <div>
                          <p className="text-xs text-white/40">Paid out</p>
                          <p className="text-xl font-black mt-1 text-emerald-400">{ghs(stats.paidOutPesewas)}</p>
                        </div>
                        <span className="text-2xl opacity-30">✅</span>
                      </motion.div>
                      <motion.div
                        initial={{ opacity: 0, y: 20 }}
                        animate={{ opacity: 1, y: 0 }}
                        transition={{ delay: 0.8 }}
                        className="card p-4 bg-white/[0.02]"
                      >
                        <p className="text-xs font-bold text-white/50 uppercase tracking-widest mb-3">Quick actions</p>
                        <div className="flex flex-wrap gap-2">
                          <button className="btn-ghost text-sm" onClick={() => setSection("Reports")}>→ Reports</button>
                          <button className="btn-ghost text-sm" onClick={() => setSection("Payouts")}>→ Payouts</button>
                          <button className="btn-ghost text-sm" onClick={() => setSection("Battles")}>→ Battle</button>
                        </div>
                      </motion.div>
                    </div>
                  </div>
                </div>
              )}

              {/* ===== REPORTS ===== */}
              {section === "Reports" && (
                <div className="space-y-3">
                  <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-2">
                    <p className="text-sm text-white/40">{reports.length} open {reports.length === 1 ? "report" : "reports"} · AI verdict helps triage</p>
                    <button onClick={handleRefresh} className="btn-ghost text-xs whitespace-nowrap" disabled={isRefreshing}>
                      {isRefreshing ? <span className="flex items-center gap-1"><motion.div className="w-3 h-3 border-2 border-[#baff39] border-t-transparent rounded-full animate-spin" /> Refreshing...</span> : 'Refresh'}
                    </button>
                  </div>
                  {reports.length === 0 ? (
                    <div className="card p-12 text-center">
                      <p className="text-5xl mb-3">✅</p>
                      <p className="text-white/40 text-sm font-medium">No open reports</p>
                      <p className="text-white/20 text-xs mt-1">All clear. Community is healthy.</p>
                    </div>
                  ) : (
                    <div className="space-y-2">
                      {reports.map((r) => (
                        <ReportCard
                          key={r.id}
                          report={r}
                          busyId={busyId}
                          onAction={(decision) => handleReportAction(r.id, decision)}
                        />
                      ))}
                    </div>
                  )}
                </div>
              )}

              {/* ===== PAYOUTS ===== */}
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
                  <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-2 text-sm">
                    <p className="text-white/40">{payouts.length} pending payout{payouts.length !== 1 ? "s" : ""} · Total {ghs(payouts.reduce((a, p) => a + p.amount, 0))}</p>
                    <button onClick={handleRefresh} className="btn-ghost text-xs whitespace-nowrap" disabled={isRefreshing}>
                      {isRefreshing ? <span className="flex items-center gap-1"><motion.div className="w-3 h-3 border-2 border-[#baff39] border-t-transparent rounded-full animate-spin" /> Refreshing...</span> : 'Refresh'}
                    </button>
                  </div>
                  {payouts.length === 0 ? (
                    <div className="card p-12 text-center">
                      <p className="text-5xl mb-3">💸</p>
                      <p className="text-white/40 text-sm font-medium">No pending payouts</p>
                      <p className="text-white/20 text-xs mt-1">Approved/paid and failed are hidden here.</p>
                    </div>
                  ) : (
                    <div className="space-y-2">
                      {payouts.map((p) => (
                        <PayoutCard
                          key={p.id}
                          payout={p}
                          busyId={busyId}
                          onApprove={() => handleApprovePayout(p.id)}
                        />
                      ))}
                    </div>
                  )}
                </div>
              )}

              {/* ===== USERS ===== */}
              {section === "Users" && (
                <div className="space-y-4">
                  <div>
                    <input id="user-search" className="input" placeholder="Search ghost name…" value={userSearch} onChange={(e) => setUserSearch(e.target.value)} />
                    <p className="text-[11px] text-white/25 mt-1.5 px-1">Search is debounced · 30 max · clear to list recent</p>
                  </div>
                  {users.length === 0 ? (
                    <div className="card p-12 text-center">
                      <p className="text-5xl mb-3">{userSearch ? "🔍" : "👻"}</p>
                      <p className="text-white/40 text-sm font-medium">{userSearch ? "No ghosts match." : "Type to search users."}</p>
                      <p className="text-white/20 text-xs mt-1">Results limited to 30 most recent.</p>
                    </div>
                  ) : (
                    <div className="space-y-2">
                      {users.map((u) => (
                        <UserCard
                          key={u.id}
                          user={u}
                          busyId={busyId}
                          onManage={() => handleDeleteUser(u.id)}
                        />
                      ))}
                    </div>
                  )}
                  <p className="text-[11px] text-white/20 px-1">Manage → Suspend (soft) / Ban (hard) · If user has posts, hard delete will fail.</p>
                </div>
              )}

              {/* ===== POSTS ===== */}
              {section === "Posts" && (
                <div className="space-y-4">
                  <div>
                    <input id="post-search" className="input" placeholder="Search post text…" value={postSearch} onChange={(e) => setPostSearch(e.target.value)} />
                    <p className="text-[11px] text-white/25 mt-1.5 px-1">Debounced · 30 max · shows ghost + snippet</p>
                  </div>
                  {posts.length === 0 ? (
                    <div className="card p-12 text-center">
                      <p className="text-5xl mb-3">{postSearch ? "🔍" : "📝"}</p>
                      <p className="text-white/40 text-sm font-medium">{postSearch ? "No posts match." : "Type to search posts."}</p>
                      <p className="text-white/20 text-xs mt-1">Results limited to 30 most recent.</p>
                    </div>
                  ) : (
                    <div className="space-y-2">
                      {posts.map((p) => (
                        <PostCard
                          key={p.id}
                          post={p}
                          busyId={busyId}
                          onDelete={() => handleDeletePost(p.id)}
                        />
                      ))}
                    </div>
                  )}
                </div>
              )}

              {/* ===== BATTLES ===== */}
              {section === "Battles" && (
                <div className="max-w-xl space-y-4">
                  <motion.div
                    initial={{ opacity: 0, y: 20 }}
                    animate={{ opacity: 1, y: 0 }}
                    className="card p-5 md:p-6"
                  >
                    <p className="font-bold text-lg">Create Battle Prompt</p>
                    <p className="text-xs text-white/30 mt-1">Campus + prompt creates an ACTIVE prompt lasting 7 days.</p>
                    <input id="battle-prompt" className="input mt-4" placeholder="Prompt text — e.g. Best Jollof on campus?" value={promptText} onChange={(e) => setPromptText(e.target.value)} />
                    <select className="input mt-2" value={campus} onChange={(e) => setCampus(e.target.value)}>
                      <option value="">Select school</option>
                      {CAMPUSES.map((c) => (
                        <option key={c} value={c}>{c}</option>
                      ))}
                    </select>
                    <button disabled={busyId === "battle"} className="btn-primary w-full mt-3 disabled:opacity-50" onClick={handleCreateBattle}>
                      {busyId === "battle" ? "Creating…" : "Create (7 days)"}
                    </button>
                  </motion.div>
                  <div className="card p-4 bg-white/[0.02]">
                    <p className="text-xs font-bold text-white/40 uppercase tracking-widest">API tips</p>
                    <p className="text-xs text-white/30 mt-2 leading-relaxed">POST <span className="text-white/60 font-mono">/api/admin/battles/create</span> accepts <span className="text-white/60">type: SINGLE|BRACKET, totalRounds, entryType: TEXT|IMAGE|VOICE, isPrimeOnly, schedule, scheduleDays, seasonId</span>.</p>
</div>
                </div>
              )}
              {/* ===== SETTINGS ===== */}
              {section === "Settings" && (
                <div className="max-w-xl space-y-4">
                  <motion.div
                    initial={{ opacity: 0, y: 20 }}
                    animate={{ opacity: 1, y: 0 }}
                    className="card p-5 md:p-6"
                  >
                    <p className="font-bold text-lg">Settings</p>
                    <p className="text-xs text-white/30 mt-1">API keys and encryption configuration.</p>
                    <div className="space-y-3 mt-4">
                      <div className="card p-4 bg-white/[0.02] border-white/5">
                        <p className="text-xs font-bold text-white/40 uppercase tracking-widest mb-2">Paystack</p>
                        <div className="space-y-2 text-xs font-mono text-white/50">
                          <p>Public Key: <span className="text-white/70">pk_test_••••••••••</span></p>
                          <p>Secret Key: <span className="text-white/70">sk_test_••••••••••</span></p>
                          <p>Webhook Secret: <span className="text-white/70">whsec_••••••••••</span></p>
                        </div>
                        <p className="text-[11px] text-amber-400/80 mt-2">Keys handle real money. Rotate quarterly.</p>
                      </div>
                      <div className="card p-4 bg-white/[0.02] border-white/5">
                        <p className="text-xs font-bold text-white/40 uppercase tracking-widest mb-2">Encryption</p>
                        <div className="space-y-2 text-xs font-mono text-white/50">
                          <p>PAYOUT_ENCRYPTION_KEY: <span className="text-white/70">••••••••••••••••</span></p>
                          <p>Algorithm: <span className="text-white/70">AES-256-GCM</span></p>
                        </div>
                        <p className="text-[11px] text-amber-400/80 mt-2">Used to encrypt bank/MoMo details at rest.</p>
                      </div>
                      <div className="card p-4 bg-white/[0.02] border-white/5">
                        <p className="text-xs font-bold text-white/40 uppercase tracking-widest mb-2">Environment</p>
                        <div className="space-y-2 text-xs font-mono text-white/50">
                          <p>NEXT_PUBLIC_APP_URL: <span className="text-white/70">https://yard.app</span></p>
                          <p>NODE_ENV: <span className="text-white/70">production</span></p>
                        </div>
                      </div>
                    </div>
                  </motion.div>
                </div>
              )}
            </motion.div>
          </AnimatePresence>
        </main>

        {/* Footer */}
        <footer className="px-4 md:px-8 py-6 border-t border-white/[0.04] mt-auto relative z-10">
          <div className="flex flex-col md:flex-row items-center justify-between gap-2">
            <p className="text-[11px] text-white/20">Yard Admin · Be careful with money actions</p>
            <p className="text-[11px] text-white/20 font-mono">AuditLog · PAYOUT_ENCRYPTION_KEY</p>
          </div>
        </footer>
      </div>

      {/* ===== MOBILE BOTTOM NAV ===== */}
      <motion.nav
        initial={{ y: 100 }}
        animate={{ y: 0 }}
        transition={{ type: "spring", damping: 20, stiffness: 200 }}
        className="fixed bottom-0 left-0 right-0 z-40 md:hidden bg-[#0a0a0a]/95 backdrop-blur-xl border-t border-white/10 safe-area-inset-bottom"
      >
        <div className="flex items-center justify-around py-2 px-1 max-w-md mx-auto">
          {MOBILE_TABS.map((tab) => {
            const isActive = mobileTab === tab.key
            return (
              <button
                key={tab.key}
                onClick={() => { setMobileTab(tab.key); setSection(tab.key); setMobileOpen(false) }}
                className={`relative flex flex-col items-center gap-0.5 py-2 px-3 rounded-xl transition-all min-w-[60px] ${
                  isActive
                    ? "text-[#baff39]"
                    : "text-white/30"
                }`}
              >
                {isActive && (
                  <motion.div
                    layoutId="mobileTabIndicator"
                    className="absolute -top-[2px] left-1/2 -translate-x-1/2 w-8 h-[3px] bg-[#baff39] rounded-full"
                    transition={{ type: "spring", stiffness: 300, damping: 30 }}
                  />
                )}
                <span className="text-lg relative z-10">{tab.icon}</span>
                <span className="text-[10px] font-semibold relative z-10">{tab.label}</span>
              </button>
            )
          })}
        </div>
      </motion.nav>

      {/* Spacer for bottom nav */}
      <div className="md:hidden h-[70px]" aria-hidden="true" />

      {/* Command Palette Modal */}
      <AnimatePresence>
        {showCommandPalette && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 z-50 flex items-start justify-center pt-20"
            onClick={() => { setShowCommandPalette(false); setCommandFilter("") }}
          >
            <motion.div
              initial={{ opacity: 0, y: -20, scale: 0.95 }}
              animate={{ opacity: 1, y: 0, scale: 1 }}
              exit={{ opacity: 0, y: -20, scale: 0.95 }}
              transition={{ type: "spring", damping: 25, stiffness: 300 }}
              className="w-full max-w-2xl mx-4 bg-[#0a0a0a]/95 backdrop-blur-xl border border-white/10 rounded-2xl shadow-2xl overflow-hidden"
              onClick={(e) => e.stopPropagation()}
            >
              <div className="p-4 border-b border-white/10 flex items-center gap-3">
                <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" className="text-white/40 flex-shrink-0">
                  <circle cx="11" cy="11" r="8" />
                  <path d="M21 21l-4.35-4.35" />
                </svg>
                <input
                  id="command-palette-input"
                  type="text"
                  value={commandFilter}
                  onChange={(e) => setCommandFilter(e.target.value)}
                  placeholder="Type a command or search…"
                  className="flex-1 bg-transparent border-none outline-none text-white text-sm font-mono"
                  autoFocus
                />
                <kbd className="text-[10px] text-white/30 bg-white/5 px-2 py-1 rounded">⌘K</kbd>
              </div>
              <div className="max-h-96 overflow-y-auto">
                {filteredCommands.length === 0 ? (
                  <div className="p-8 text-center text-white/30">No commands match</div>
                ) : (
                  <div className="py-2">
                    {filteredCommands.map((item, idx) => (
                      <button
                        key={item.label + idx}
                        onClick={() => { item.action(); setShowCommandPalette(false); setCommandFilter("") }}
                        className="w-full px-4 py-3 flex items-center justify-between gap-3 hover:bg-white/5 transition-colors"
                      >
                        <div>
                          <p className="text-sm font-medium text-white">{item.label}</p>
                          <p className="text-[10px] text-white/30 uppercase tracking-wider">{item.section}</p>
                        </div>
                        <kbd className="text-[10px] text-white/30 bg-white/5 px-2 py-1 rounded font-mono">{item.shortcut}</kbd>
                      </button>
                    ))}
                  </div>
                )}
              </div>
              <div className="p-3 border-t border-white/10 text-right">
                <p className="text-[10px] text-white/20">Press <kbd className="bg-white/5 px-1.5 py-0.5 rounded">Esc</kbd> to close</p>
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Keyboard Shortcuts Help Modal */}
      <AnimatePresence>
        {showShortcuts && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 z-50 flex items-center justify-center p-4"
            onClick={() => setShowShortcuts(false)}
          >
            <motion.div
              initial={{ opacity: 0, scale: 0.95, y: 20 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.95, y: 20 }}
              transition={{ type: "spring", damping: 25, stiffness: 300 }}
              className="w-full max-w-md bg-[#0a0a0a]/95 backdrop-blur-xl border border-white/10 rounded-2xl shadow-2xl overflow-hidden"
              onClick={(e) => e.stopPropagation()}
            >
              <div className="p-4 border-b border-white/10 flex items-center justify-between">
                <p className="font-bold">Keyboard Shortcuts</p>
                <button onClick={() => setShowShortcuts(false)} className="w-8 h-8 rounded-full bg-white/5 grid place-items-center text-white/60 hover:bg-white/10 transition-colors">✕</button>
              </div>
              <div className="p-4 space-y-4 max-h-[60vh] overflow-y-auto">
                {[
                  { title: "Navigation", items: [
                    { key: "g o", desc: "Go to Overview" },
                    { key: "g r", desc: "Go to Reports" },
                    { key: "g p", desc: "Go to Payouts" },
                    { key: "g u", desc: "Go to Users" },
                    { key: "g P", desc: "Go to Posts" },
                    { key: "g b", desc: "Go to Battles" },
                    { key: "g s", desc: "Go to Settings" },
                  ]},
                  { title: "Actions", items: [
                    { key: "r", desc: "Refresh current section" },
                    { key: "/", desc: "Focus search (context-aware)" },
                    { key: "n", desc: "New battle prompt (in Battles)" },
                    { key: "⌘D", desc: "Toggle dense mode" },
                  ]},
                  { title: "Global", items: [
                    { key: "⌘K", desc: "Open command palette" },
                    { key: "?", desc: "Show this help" },
                    { key: "Esc", desc: "Close modals / blur inputs" },
                  ]},
                ].map((group) => (
                  <div key={group.title} className="space-y-2">
                    <p className="text-[10px] font-bold text-white/30 uppercase tracking-wider">{group.title}</p>
                    <div className="grid grid-cols-2 gap-2">
                      {group.items.map((item) => (
                        <div key={item.key} className="flex items-center justify-between px-3 py-2 bg-white/5 rounded-xl">
                          <span className="text-sm text-white/80">{item.desc}</span>
                          <kbd className="text-[10px] font-mono text-white/40 bg-white/5 px-2 py-1 rounded">{item.key}</kbd>
                        </div>
                      ))}
                    </div>
                  </div>
                ))}
              </div>
              <div className="p-3 border-t border-white/10 text-center">
                <p className="text-[10px] text-white/20">Press <kbd className="bg-white/5 px-1.5 py-0.5 rounded">Esc</kbd> to close</p>
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  )
}

/* ===== REUSABLE CARD COMPONENTS ===== */

function ReportCard({ report, busyId, onAction }: { report: Report; busyId: string | null; onAction: (decision: "actioned" | "dismissed") => void }) {
  return (
    <motion.div
      initial={{ opacity: 0, y: 10 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.2 }}
      className="card p-4 md:p-5"
    >
      <div className="flex items-start justify-between gap-3">
        <p className="text-xs text-white/40">Reported by <span className="text-white/70 font-semibold">{report.reporter.ghostId}</span> · ID {report.id.slice(0, 8)}…</p>
        {report.aiVerdict && (
          <span className={`badge flex-shrink-0 ${report.aiVerdict === "VIOLATION" ? "badge-prime" : "badge-boosted"}`}>AI: {report.aiVerdict}</span>
        )}
      </div>
      <p className="text-sm text-white/80 mt-2">Reason: <span className="text-white font-medium">{report.reason}</span></p>
      <p className="text-white/90 text-sm mt-3 p-3 rounded-xl bg-white/[0.03] border border-white/5 whitespace-pre-wrap">{report.post?.text || "(no text / image post)"}</p>
      <div className="flex gap-2 mt-4">
        <button disabled={!!busyId} className="btn-ghost flex-1 disabled:opacity-50 active:scale-[0.98]" onClick={() => onAction("dismissed")}>
          {busyId === report.id ? "…" : "Dismiss"}
        </button>
        <button disabled={!!busyId} className="btn-primary flex-1 disabled:opacity-50 active:scale-[0.98]" onClick={() => onAction("actioned")}>
          {busyId === report.id ? "Working…" : "Remove post"}
        </button>
      </div>
    </motion.div>
  )
}

function PayoutCard({ payout, busyId, onApprove }: { payout: Payout; busyId: string | null; onApprove: () => void }) {
  return (
    <motion.div
      initial={{ opacity: 0, y: 10 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.2 }}
      className="card p-4 md:p-5"
    >
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <p className="text-sm font-bold truncate">{payout.user.ghostId}</p>
          <p className="text-xs text-white/40 truncate">{payout.user.email} · {payout.id.slice(0, 8)}…</p>
        </div>
        <span className="text-sm font-black bg-[#baff39]/10 border border-[#baff39]/20 text-[#baff39] px-3 py-1 rounded-full flex-shrink-0">{ghs(payout.amount)}</span>
      </div>
      <div className="mt-3 p-3 rounded-xl bg-white/[0.03] border border-white/5">
        <p className="text-[11px] tracking-widest font-bold text-white/25 uppercase">Recipient</p>
        <p className="text-xs text-white/60 mt-1 break-all">{payout.accountName || "—"} · {payout.accountNumber || "—"} · <span className="font-mono">{payout.bankCode || "—"}</span></p>
        <p className="text-[11px] text-white/20 mt-1">If you see hex like "a3f1:…" it means details are still encrypted — do not approve until readable.</p>
      </div>
      <button disabled={!!busyId} className="btn-primary w-full mt-3 disabled:opacity-50 active:scale-[0.98]" onClick={onApprove}>
        {busyId === payout.id ? "Processing…" : "Approve & Pay via Paystack"}
      </button>
    </motion.div>
  )
}

function UserCard({ user, busyId, onManage }: { user: AdminUser; busyId: string | null; onManage: () => void }) {
  return (
    <motion.div
      key={user.id}
      initial={{ opacity: 0, x: -10 }}
      animate={{ opacity: 1, x: 0 }}
      transition={{ duration: 0.15 }}
      className="card p-3 flex items-center justify-between gap-3"
    >
      <div className="min-w-0 flex-1">
        <p className="text-sm font-semibold truncate">{user.ghostId} {user.tier !== "FREE" && <span className="badge badge-prime ml-1">{user.tier}</span>}</p>
        <p className="text-xs text-white/40 truncate">{user.email} · {user.campus}</p>
        <p className="text-[11px] font-mono text-white/20 truncate">{user.id}</p>
      </div>
      <button disabled={!!busyId} className={`text-xs font-bold px-3 py-1.5 rounded-full border flex-shrink-0 disabled:opacity-50 transition-all active:scale-[0.95] ${busyId === user.id ? "bg-white/5 border-white/10 text-white/30" : "bg-red-500/10 border-red-500/20 text-red-400 hover:bg-red-500/15"}`} onClick={onManage}>
        {busyId === user.id ? "…" : "Manage"}
      </button>
    </motion.div>
  )
}

function PostCard({ post, busyId, onDelete }: { post: AdminPost; busyId: string | null; onDelete: () => void }) {
  return (
    <motion.div
      key={post.id}
      initial={{ opacity: 0, x: -10 }}
      animate={{ opacity: 1, x: 0 }}
      transition={{ duration: 0.15 }}
      className="card p-3 flex items-center justify-between gap-3"
    >
      <div className="min-w-0 flex-1">
        <p className="text-xs text-white/40">{post.user.ghostId} · <span className="font-mono text-white/20">{post.id.slice(0, 8)}…</span></p>
        <p className="text-sm truncate">{post.text || "(image/voice post)"}</p>
      </div>
      <button disabled={!!busyId} className="text-red-400 text-xs font-bold px-3 py-1.5 rounded-full border border-red-500/20 bg-red-500/10 hover:bg-red-500/15 disabled:opacity-50 flex-shrink-0 transition-all active:scale-[0.95]" onClick={onDelete}>
        {busyId === post.id ? "…" : "Delete"}
      </button>
    </motion.div>
  )
}
