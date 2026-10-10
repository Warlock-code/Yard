"use client"

import { useCallback, useEffect, useMemo, useRef, useState } from "react"
import { useRouter } from "next/navigation"
import Link from "next/link"
import { motion, AnimatePresence } from "framer-motion"
import { apiGet, apiPost, apiDelete, apiPatch } from "@/lib/useApi"
import { timeAgo } from "@/lib/timeAgo"
import RichText from "@/app/components/RichText"
import { useSocket } from "@/lib/socket"
import OptimizedImage from "@/app/components/OptimizedImage"
import Avatar from "@/app/components/Avatar"
import ChampionTrophies from "@/app/components/ChampionTrophies"
import SmartNudge from "@/app/components/SmartNudge"
import { getRushStatus } from "@/lib/rush"
import { logPaywallHit } from "@/lib/logPaywall"
import { getCached, setCached, cacheKeys, TTL, fetchDeduped } from "@/lib/client-cache"
import { signalContentReady } from "@/app/components/BootGate"

function PostSkeleton() {
  return (
    <div className="px-4 py-3 border-b border-white/[0.06]">
      <div className="flex items-start gap-3">
        <div className="flex-shrink-0">
          <div className="w-10 h-10 rounded-full skeleton-shimmer" />
        </div>
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2 flex-wrap text-sm">
            <div className="h-4 w-32 skeleton-shimmer rounded" />
            <div className="h-4 w-16 skeleton-shimmer rounded" />
            <div className="h-4 w-24 skeleton-shimmer rounded ml-auto" />
          </div>
          <div className="mt-1 space-y-2">
            <div className="h-4 w-full skeleton-shimmer rounded" />
            <div className="h-4 w-5/6 skeleton-shimmer rounded" />
            <div className="h-4 w-3/4 skeleton-shimmer rounded" />
            <div className="h-4 w-1/2 skeleton-shimmer rounded" />
          </div>
          <div className="relative w-full h-64 mt-2 rounded-xl skeleton-shimmer bg-white/5 border border-white/10" />
          <div className="flex flex-wrap items-center gap-x-5 gap-y-2 pt-2">
            <div className="h-5 w-14 skeleton-shimmer rounded-full" />
            <div className="h-5 w-16 skeleton-shimmer rounded-full" />
            <div className="h-5 w-10 skeleton-shimmer rounded-full" />
            <div className="h-5 w-10 skeleton-shimmer rounded-full" />
            <div className="h-5 w-8 skeleton-shimmer rounded-full ml-auto" />
          </div>
        </div>
      </div>
    </div>
  )
}

type Post = {
  id: string
  text: string | null
  imageUrl: string | null
  imageUrls?: string[]
  type: string
  yeahs: number
  commentsCount: number
  boosted: boolean
  pinned?: boolean
  pinnedUntil?: string | null
  heating?: boolean
  freshLove?: boolean
  isFollowing: boolean
  seen?: boolean
  createdAt: string
  user: { id: string; ghostId: string; avatarEmoji: string; tier: string; championTrophies?: number }
}

type PostHints = {
  views: number
  heats: number
  byProgram?: { program: string; views: number; heats: number }[]
  byYear?: { cohortYear: number; views: number; heats: number }[]
  followerContext?: { followingYou: number; youFollow: number }
}

type InlineComment = {
  id: string
  text: string
  ghostId: string
  createdAt: string
  parentId: string | null
  replies: InlineComment[]
  user?: { ghostId: string; avatarEmoji: string; tier?: string; championTrophies?: number }
}

type Me = {  id: string
  ghostId: string
  avatarEmoji: string
  campus: string
  tier: string
  rawTier?: string
  tierExpiresAt?: string | null
  tierDaysLeft?: number | null
  isTrial?: boolean
  streakCount: number
  followersCount: number
  followingCount: number
  totalEarnedPesewas?: number
  availableBalancePesewas?: number
  hasPendingPayout?: boolean
  championTrophies?: number
  storageUsed?: number
  storageLimit?: number
  ghostCoins?: number
  cohortYear?: number | null
  // Invite-nudge targeting (from /api/auth/me).
  createdAt?: string
  referralCount?: number
  inviteCode?: string
}

const TABS = [
  { key: "campus", label: "for you", description: "posts from your school/program" },
  { key: "following", label: "following", description: "posts from ghosts you follow" },
  { key: "all", label: "all", description: "posts from every school" },
  { key: "program", label: "class", description: "posts from your class (program + admission year)" },
]

const EMPTY_MESSAGES: Record<string, string> = {
  campus: "no posts from your school/program yet",
  following: "no posts from ghosts you follow yet — tap + on posts to follow ghosts",
  all: "no posts from any school yet",
  program: "no posts from your program yet — be first in class",
}

function CohortPrompt({ onSaved }: { onSaved: (year: number) => void }) {
  const years = useMemo(() => {
    const current = new Date().getFullYear() + 1
    return Array.from({ length: 12 }, (_, i) => current - i)
  }, [])
  const [year, setYear] = useState("")
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState("")

  async function save() {
    if (!year || saving) return
    setSaving(true)
    setError("")
    try {
      await apiPatch("/api/profile/cohort", { cohortYear: Number(year) })
      onSaved(Number(year))
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : "could not save. try again.")
    } finally {
      setSaving(false)
    }
  }

  return (
    <div className="mx-4 mt-3 rounded-xl border border-[#baff39]/30 bg-[#baff39]/[0.06] p-4">
      <p className="font-bold text-sm">which year were you admitted?</p>
      <p className="text-xs text-white/50 mt-1 mb-3">class feed is now per admission year — pick yours to see your own class.</p>
      <div className="flex gap-2">
        <select
          className="input flex-1"
          value={year}
          onChange={(e) => setYear(e.target.value)}
          aria-label="admission year"
        >
          <option value="" disabled>year</option>
          {years.map((y) => (
            <option key={y} value={y}>{y}</option>
          ))}
        </select>
        <button className="btn-primary px-4 text-sm" onClick={save} disabled={!year || saving}>
          {saving ? "saving..." : "save"}
        </button>
      </div>
      {error && <p className="text-red-400 text-xs mt-2">{error}</p>}
    </div>
  )
}

export default function FeedPage() {
  const router = useRouter()
  const [me, setMe] = useState<Me | null>(null)
  // Guest browsing: logged-out visitors read the global feed and are
  // funneled to /signup the moment they try to interact.
  const [guest, setGuest] = useState(false)
  // Auth resolution gate: the feed fetch waits until /me settles so a
  // guest's first paint doesn't race into a login redirect.
  const [authReady, setAuthReady] = useState(false)
  const [posts, setPosts] = useState<Post[]>([])
  const [mode, setMode] = useState("campus")
  const [loading, setLoading] = useState(true)
  const [nextCursor, setNextCursor] = useState<string | null>(null)
  const [loadingMore, setLoadingMore] = useState(false)
  const [showNameModal, setShowNameModal] = useState(false)
  const [newName, setNewName] = useState("")
  const [showDrawer, setShowDrawer] = useState(false)
  const [showAvatarModal, setShowAvatarModal] = useState(false)
  const [availableAvatars, setAvailableAvatars] = useState<string[]>([])

const [feedVersion, setFeedVersion] = useState(0)
// Per-refresh shuffle seed: new seed on every refresh/tab-switch so
// tied posts rotate; same seed is reused for infinite-scroll pages so
// cursor pagination stays consistent within one refresh session.
const [refreshSeed, setRefreshSeed] = useState(() => newRefreshSeed())
const [followingByAuthor, setFollowingByAuthor] = useState<Record<string, boolean>>({})
const [pendingFollows, setPendingFollows] = useState<Set<string>>(new Set())
const pendingFollowRequests = useRef(new Set<string>())
const [pullToRefresh, setPullToRefresh] = useState(false)
const pullStartRef = useRef<number | null>(null)
const viewObserverRef = useRef<IntersectionObserver | null>(null)
const loadMoreRef = useRef<HTMLDivElement | null>(null)
const viewedPostsRef = useRef<Set<string>>(new Set())

// Expand + inline comments (X-style tap anywhere)
  const [expandedId, setExpandedId] = useState<string | null>(null)
  const [inlineComments, setInlineComments] = useState<Record<string, InlineComment[]>>({})
  const [inlineLoading, setInlineLoading] = useState<Record<string, boolean>>({})
  const [inlineDraft, setInlineDraft] = useState<Record<string, string>>({})
  const [inlineSubmitting, setInlineSubmitting] = useState<Record<string, boolean>>({})
  // Heat optimistic + animation
  const [votedIds, setVotedIds] = useState<Set<string>>(new Set())
  const [poppingId, setPoppingId] = useState<string | null>(null)
  const pendingVotes = useRef(new Set<string>())
  // Live posts queue as a tap-to-load pill (no feed jump while reading).
  const [pendingPosts, setPendingPosts] = useState<Post[]>([])
  // Onboarding invite ask: one-time card for 2+ day old users with zero
  // referrals. Dismissal persists in localStorage — shown once, ever.
  const [showInviteNudge, setShowInviteNudge] = useState(false)
  const [inviteCopied, setInviteCopied] = useState(false)
  // Hints panel (own posts): who viewed/voted, tiered breakdowns.
  const [hintsOpenId, setHintsOpenId] = useState<string | null>(null)
  const [hintsData, setHintsData] = useState<Record<string, PostHints>>({})
  const [hintsLoading, setHintsLoading] = useState<Record<string, boolean>>({})
  // Onboarding invite ask: day 2–3 after signup, zero referrals, once ever.
  useEffect(() => {
    if (guest || !me || !authReady || showInviteNudge) return
    try {
      if (localStorage.getItem("yard_invite_nudge_seen") === "1") return
    } catch { return }
    const created = me.createdAt ? new Date(me.createdAt).getTime() : NaN
    if (!Number.isFinite(created)) return
    const ageDays = (Date.now() - created) / (24 * 60 * 60 * 1000)
    if (ageDays >= 2 && (me.referralCount ?? 0) === 0) setShowInviteNudge(true)
  }, [guest, me, authReady, showInviteNudge])

  function dismissInviteNudge() {
    try { localStorage.setItem("yard_invite_nudge_seen", "1") } catch {}
    setShowInviteNudge(false)
  }

  async function copyInviteLink() {
    if (!me?.inviteCode) return
    try {
      await navigator.clipboard.writeText(`${window.location.origin}/join?ref=${me.inviteCode}`)
      setInviteCopied(true)
      setTimeout(() => setInviteCopied(false), 1500)
    } catch {
      router.push("/lair")
    }
  }

  // Live tick for rush-hour banner countdown (cheap 60s interval).
  const [rushNow, setRushNow] = useState(() => Date.now())
  useEffect(() => {
    const t = setInterval(() => setRushNow(Date.now()), 60_000)
    return () => clearInterval(t)
  }, [])
  const rushStatus = getRushStatus(new Date(rushNow))
  const rushMinsLeft = rushStatus.live ? Math.max(1, Math.ceil((rushStatus.endsAt.getTime() - rushNow) / 60_000)) : 0

  const { connected, on } = useSocket()

  const loadMe = useCallback((isCurrent: () => boolean = () => true) => {
    // Deduped: shares one in-flight /me with ThemeProvider + BottomNav +
    // prewarm when they fire on the same cold-boot tick. Same URL, same
    // response handling — behavior unchanged.
    return fetchDeduped("GET /api/auth/me", () => apiGet<{ user: Me | null }>("/api/auth/me"))
      .then((data) => {
        if (!data.user) {
          // No session: guest mode (read-only global feed), never a wall.
          if (isCurrent()) {
            setGuest(true)
            setMode("all")
          }
          return
        }
        setCached(cacheKeys.me, data, TTL.me)
        if (isCurrent()) setMe(data.user)
      })
      .catch(() => {
        if (isCurrent() && !getCached<{ user: Me | null }>(cacheKeys.me)) {
          setGuest(true)
          setMode("all")
        }
      })
      .finally(() => {
        if (isCurrent()) setAuthReady(true)
      })
  }, [router])

  function newRefreshSeed() {
    return `${Date.now().toString(36)}${Math.random().toString(36).slice(2)}`
  }

  function loadFeed() {
    setLoading(true)
    setLoadingMore(false)
    setPendingPosts([])
    setRefreshSeed(newRefreshSeed())
    setFeedVersion((version) => version + 1)
  }

  function selectMode(nextMode: string) {
    if (nextMode === mode) return
    // Guests only get the global feed — other tabs are a signup prompt.
    if (guest && nextMode !== "all") {
      router.push("/signup")
      return
    }
    setLoading(true)
    setLoadingMore(false)
    setPendingPosts([])
    setRefreshSeed(newRefreshSeed())
    setMode(nextMode)
  }

  function showNewPosts() {
    const fresh = pendingPosts
    setPendingPosts([])
    if (fresh.length === 0) return
    setPosts((prev) => {
      const ids = new Set(prev.map((p) => p.id))
      return [...fresh.filter((p) => !ids.has(p.id)), ...prev]
    })
    window.scrollTo({ top: 0, behavior: "smooth" })
  }

  useEffect(() => {
    let active = true
    // Instant paint from cache, then silent revalidate
    const cachedMe = getCached<{ user: Me | null }>(cacheKeys.me)
    if (cachedMe?.user && active) setMe(cachedMe.user)
    loadMe(() => active)
    return () => { active = false }
  }, [loadMe])

  // Tell BootGate the waking screen can leave: first content painted.
  useEffect(() => {
    if (!loading) signalContentReady()
  }, [loading])

  useEffect(() => {
    // Wait for /me so guests don't fetch campus-mode (401) mid-race.
    // Guests always land on mode "all", which the API serves logged-out.
    if (!authReady) return
    let active = true
    // Show cached campus feed instantly on first paint
    if (mode === "campus" && feedVersion === 0) {
      const cached = getCached<{ posts: Post[]; nextCursor: string | null }>(cacheKeys.feed("campus"))
      if (cached?.posts?.length) {
        setPosts(cached.posts)
        setNextCursor(cached.nextCursor)
        setLoading(false)
      }
    }
    apiGet<{ posts: Post[]; nextCursor: string | null }>(`/api/posts?mode=${mode}&seed=${refreshSeed}`)
      .then((data) => {
        if (!active) return
        setPosts(data.posts)
        setNextCursor(data.nextCursor)
        if (mode === "campus") setCached(cacheKeys.feed("campus"), data, TTL.feed)
      })
      .catch((err: unknown) => {
        if (!active) return
        if (err instanceof Error && err.message === "not authenticated.") {
          // Stale session on a private mode (guests never hit this —
          // their mode is forced to "all" before the first fetch).
          if (!guest) router.push("/login")
          else setLoading(false)
          return
        }
        console.error(err)
      })
      .finally(() => {
        if (active) setLoading(false)
      })
    return () => { active = false }
  }, [mode, feedVersion, refreshSeed, router, authReady, guest])

  useEffect(() => {
    if (loading || !nextCursor) return
    let active = true
    let pending = false

    async function loadMore() {
      if (pending) return
      pending = true
      setLoadingMore(true)
      try {
        const data = await apiGet<{ posts: Post[]; nextCursor: string | null }>(`/api/posts?mode=${mode}&cursor=${nextCursor}&seed=${refreshSeed}`)
        if (!active) return
        // Dedupe by id: a re-fired page fetch must never render twins.
        setPosts((prev) => {
          const seen = new Set(prev.map((p) => p.id))
          const fresh = data.posts.filter((p) => !seen.has(p.id))
          if (fresh.length === 0) return prev
          return [...prev, ...fresh]
        })
        setNextCursor(data.nextCursor)
      } catch (err) {
        console.error(err)
      } finally {
        pending = false
        if (active) setLoadingMore(false)
      }
    }

    function handleScroll() {
      if (window.innerHeight + window.scrollY >= document.body.offsetHeight - 300) {
        loadMore()
      }
    }
    const loadObserver = new IntersectionObserver(
      (entries) => {
        if (entries.some((entry) => entry.isIntersecting)) loadMore()
      },
      { rootMargin: "600px 0px" }
    )
    if (loadMoreRef.current) loadObserver.observe(loadMoreRef.current)
    window.addEventListener("scroll", handleScroll)
    return () => {
      active = false
      loadObserver.disconnect()
      window.removeEventListener("scroll", handleScroll)
    }
  }, [nextCursor, loading, mode, feedVersion, refreshSeed])

  // Track viewed posts via IntersectionObserver
  useEffect(() => {
    viewObserverRef.current = new IntersectionObserver(
      (entries) => {
        entries.forEach((entry) => {
          if (entry.isIntersecting) {
            const postId = entry.target.getAttribute("data-post-id")
            if (postId && !viewedPostsRef.current.has(postId)) {
              viewedPostsRef.current.add(postId)
              fetch(`/api/posts/${postId}/view`, { method: "POST", credentials: "include" }).catch(() => {})
            }
          }
        })
      },
      { threshold: 0.5, rootMargin: "100px" }
    )

    const elements = document.querySelectorAll("[data-post-id]")
    elements.forEach((el) => viewObserverRef.current?.observe(el))

    return () => {
      viewObserverRef.current?.disconnect()
    }
  }, [posts, feedVersion])

  useEffect(() => {
    if (!connected) return
    const unsubNewPost = on("new_post", (post: Post & { campus: string }) => {
      if (mode === "campus" && post.campus === me?.campus) {
        // Queue behind a pill instead of prepending — reading never jumps.
        setPendingPosts((prev) => (prev.some((p) => p.id === post.id) ? prev : [post, ...prev].slice(0, 20)))
      }
    })
    const unsubVote = on("vote_update", ({ postId, yeahs }: { postId: string; yeahs: number }) => {
      setPosts((prev) => prev.map((p) => (p.id === postId ? { ...p, yeahs } : p)))
    })
    const unsubComment = on("comment_added", ({ postId, comment }: { postId: string; comment: InlineComment }) => {
      // if expanded inline, append without dupe
      setInlineComments((prev) => {
        if (!prev[postId]) return prev
        if (prev[postId].some((c) => c.id === comment.id)) return prev
        // replace temp if same text/ghost
        const filtered = prev[postId].filter((c) => !String(c.id).startsWith("temp-"))
        return { ...prev, [postId]: [...filtered, comment] }
      })
      setPosts((ps) => ps.map((p) => (p.id === postId ? { ...p, commentsCount: p.commentsCount + 1 } : p)))
    })
    return () => {
      unsubNewPost()
      unsubVote()
      unsubComment()
    }
  }, [connected, on, mode, me?.campus])

  async function handleVote(postId: string) {
    if (guest) {
      router.push("/signup")
      return
    }
    if (pendingVotes.current.has(postId) || votedIds.has(postId)) return
    const prev = posts.find((p) => p.id === postId)
    if (!prev) return
    pendingVotes.current.add(postId)
    setVotedIds((s) => new Set(s).add(postId))
    setPosts((prevPs) => prevPs.map((p) => (p.id === postId ? { ...p, yeahs: p.yeahs + 1 } : p)))
    setPoppingId(postId)
    setTimeout(() => setPoppingId((c) => (c === postId ? null : c)), 420)
    try {
      const res = await apiPost<{ post?: { yeahs?: number } }>(`/api/posts/${postId}/vote`, {})
      const freshYeahs = res.post?.yeahs
      if (freshYeahs != null) {
        setPosts((ps) => ps.map((p) => (p.id === postId ? { ...p, yeahs: freshYeahs } : p)))
      }
    } catch (err: unknown) {
      // revert on error (already voted / own post / network)
      setPosts((ps) => ps.map((p) => (p.id === postId ? { ...p, yeahs: prev.yeahs } : p)))
      setVotedIds((s) => {
        const n = new Set(s)
        n.delete(postId)
        return n
      })
      const msg = err instanceof Error ? err.message : "something went wrong."
      if (!msg.includes("already voted")) alert(msg)
    } finally {
      pendingVotes.current.delete(postId)
    }
  }

  async function toggleExpand(postId: string) {
    // Guests read the preview; the full thread is behind signup.
    if (guest) {
      router.push("/signup")
      return
    }
    if (expandedId === postId) {
      setExpandedId(null)
      return
    }
    setExpandedId(postId)
    if (inlineComments[postId]) return
    setInlineLoading((s) => ({ ...s, [postId]: true }))
    try {
      const data = await apiGet<{ comments: InlineComment[] }>(`/api/posts/${postId}/comments`)
      setInlineComments((s) => ({ ...s, [postId]: data.comments || [] }))
    } catch (e) {
      console.error(e)
    } finally {
      setInlineLoading((s) => ({ ...s, [postId]: false }))
    }
  }

  async function handleInlineSubmit(postId: string) {
    const text = inlineDraft[postId]?.trim().toLowerCase()
    if (!text) return
    if (!me) {
      router.push("/signup")
      return
    }
    const tempId = `temp-${Date.now()}`
    const optimistic: InlineComment = {
      id: tempId,
      text,
      ghostId: me.ghostId,
      user: { ghostId: me.ghostId, avatarEmoji: me.avatarEmoji },
      createdAt: new Date().toISOString(),
      parentId: null,
      replies: [],
    }
    setInlineComments((s) => ({ ...s, [postId]: [...(s[postId] || []), optimistic] }))
    setPosts((prev) => prev.map((p) => (p.id === postId ? { ...p, commentsCount: p.commentsCount + 1 } : p)))
    setInlineDraft((s) => ({ ...s, [postId]: "" }))
    setInlineSubmitting((s) => ({ ...s, [postId]: true }))
    try {
      const data = await apiPost<{ comment: InlineComment }>(`/api/posts/${postId}/comments`, { text, parentId: null })
      const real = data.comment
      setInlineComments((s) => ({
        ...s,
        [postId]: (s[postId] || []).map((c) => (c.id === tempId ? { ...real, replies: real.replies || [] } : c)),
      }))
    } catch (err: unknown) {
      setInlineComments((s) => ({ ...s, [postId]: (s[postId] || []).filter((c) => c.id !== tempId) }))
      setPosts((prev) => prev.map((p) => (p.id === postId ? { ...p, commentsCount: Math.max(0, p.commentsCount - 1) } : p)))
      setInlineDraft((s) => ({ ...s, [postId]: text }))
      alert(err instanceof Error ? err.message : "failed to comment")
    } finally {
      setInlineSubmitting((s) => ({ ...s, [postId]: false }))
    }
  }

  async function handleBoost(postId: string) {
    try {
      const data = await apiPost<{ success?: boolean; message?: string }>(`/api/boost/${postId}`, {})
      alert(data.message || "boosted for 24h!")
      loadFeed()
    } catch (err: unknown) {
      alert(err instanceof Error ? err.message : "something went wrong.")
    }
  }

  async function handlePin(postId: string) {
    if (!confirm("pin this post to the top of campus for 1hr — 1000 credits?")) return
    try {
      await apiPost(`/api/shop/pin`, { postId })
      alert("pinned 📌 — top of campus for 1hr!")
      loadFeed()
    } catch (err: unknown) {
      alert(err instanceof Error ? err.message : "something went wrong.")
    }
  }

  async function toggleHints(postId: string) {
    if (hintsOpenId === postId) {
      setHintsOpenId(null)
      return
    }
    setHintsOpenId(postId)
    if (hintsData[postId]) return
    setHintsLoading((s) => ({ ...s, [postId]: true }))
    try {
      const data = await apiGet<PostHints>(`/api/posts/${postId}/hints`)
      setHintsData((s) => ({ ...s, [postId]: data }))
    } catch (e) {
      console.error(e)
    } finally {
      setHintsLoading((s) => ({ ...s, [postId]: false }))
    }
  }

  async function handleFollow(targetUserId: string) {
    if (!me) {
      router.push("/signup")
      return
    }
    if (pendingFollowRequests.current.has(targetUserId)) return
    pendingFollowRequests.current.add(targetUserId)
    setPendingFollows(new Set(pendingFollowRequests.current))
    try {
      const data = await apiPost<{ following: boolean }>("/api/follow", { targetUserId })
      setFollowingByAuthor((prev) => ({ ...prev, [targetUserId]: data.following }))
      setPosts((prev) => prev.map((post) => post.user.id === targetUserId ? { ...post, isFollowing: data.following } : post))
      loadMe()
    } catch (err: unknown) {
      alert(err instanceof Error ? err.message : "something went wrong.")
    } finally {
      pendingFollowRequests.current.delete(targetUserId)
      setPendingFollows(new Set(pendingFollowRequests.current))
    }
  }

  async function handleReport(postId: string) {
    if (guest) {
      router.push("/signup")
      return
    }
    const reason = prompt("why are you reporting this post?")
    if (!reason?.trim()) return
    try {
      await apiPost("/api/reports", { postId, reason })
      // Server archives the post immediately pending admin review —
      // drop it locally so it vanishes instantly, then refresh.
      setPosts((prev) => prev.filter((p) => p.id !== postId))
      alert("reported — this post is now hidden pending review.")
      loadFeed()
    } catch (err: unknown) {
      alert(err instanceof Error ? err.message : "something went wrong.")
    }
  }

  function handleTouchStart(e: React.TouchEvent) {
    pullStartRef.current = e.touches[0].clientY
  }

  function handleTouchMove(e: React.TouchEvent) {
    if (pullStartRef.current === null) return
    const delta = e.touches[0].clientY - pullStartRef.current
    if (delta > 0 && window.scrollY === 0) {
      e.preventDefault()
      setPullToRefresh(delta > 80)
    }
  }

  function handleTouchEnd() {
    if (pullToRefresh && pullStartRef.current !== null) {
      loadFeed()
    }
    setPullToRefresh(false)
    pullStartRef.current = null
  }

  async function handleDelete(postId: string) {
    if (!confirm("delete this post?")) return
    try {
      await apiDelete(`/api/posts/${postId}`)
      setPosts((prev) => prev.filter((p) => p.id !== postId))
    } catch (err: unknown) {
      alert(err instanceof Error ? err.message : "something went wrong.")
    }
  }

  async function handleEdit(postId: string, currentText: string | null) {
    const rawEdit = prompt("edit your post:", currentText || "")
    if (rawEdit === null || !rawEdit.trim()) return
    const newText = rawEdit.toLowerCase()
    try {
      await apiPatch(`/api/posts/${postId}`, { text: newText })
      setPosts((prev) => prev.map((p) => (p.id === postId ? { ...p, text: newText } : p)))
    } catch (err: unknown) {
      alert(err instanceof Error ? err.message : "something went wrong.")
    }
  }

  async function handleNameChange() {
    if (!newName.trim()) return
    try {
      const data = await apiPost<{ ghostId?: string; message?: string }>("/api/shop/custom-name", { newName, useCredits: true })
      alert(data.message || "ghost name changed!")
      setNewName("")
      setShowNameModal(false)
      loadMe()
    } catch (err: unknown) {
      alert(err instanceof Error ? err.message : "something went wrong.")
    }
  }

  async function openAvatarModal() {
    try {
      const data = await apiGet<{ available: string[] }>("/api/profile/avatar")
      setAvailableAvatars(data.available)
      setShowDrawer(false)
      setShowAvatarModal(true)
    } catch (err: unknown) {
      alert(err instanceof Error ? err.message : "something went wrong.")
    }
  }

  async function handlePickAvatar(emoji: string) {
    try {
      await apiPost("/api/profile/avatar", { emoji })
      setShowAvatarModal(false)
      loadMe()
    } catch (err: unknown) {
      alert(err instanceof Error ? err.message : "something went wrong.")
    }
  }

  async function handleLogout() {
    try {
      await fetch("/api/auth/logout", { method: "POST", credentials: "include" })
    } catch {}
    // Preserve yard_seen_welcome so logout doesn't reset onboarding.
    document.cookie = "yard_token=; Max-Age=0; path=/"
    router.push("/login")
  }

  return (
    <main 
      className="min-h-screen max-w-lg mx-auto pb-28 relative" 
      onTouchStart={handleTouchStart}
      onTouchMove={handleTouchMove}
      onTouchEnd={handleTouchEnd}
    >
      <div className="relative flex items-center justify-center px-4 py-3">
        <button onClick={() => (guest ? router.push("/signup") : setShowDrawer(true))} className="absolute left-4" aria-label={guest ? "join yard" : "open menu"}>
          <Avatar emoji={me?.avatarEmoji || "👻"} size={32} />
        </button>
        <span className="brand-mark font-black text-lg tracking-tight">
          YARD<span className="text-primary">.</span>
        </span>
        {me != null && (
          <button
            onClick={() => router.push("/lair")}
            aria-label={`${me.streakCount} day streak — open lair to freeze`}
            title="streak — freeze it in the lair before it breaks"
            className="absolute right-14 flex h-8 items-center gap-1 rounded-full border border-white/10 bg-white/5 px-2.5 text-xs font-bold text-white/70 hover:text-white hover:border-[#baff39]/40"
          >
            <span aria-hidden="true">🔥</span>
            <span>{me.streakCount}</span>
          </button>
        )}
        <Link href="/explore" aria-label="search" className="absolute right-4 flex h-8 w-8 items-center justify-center rounded-full text-lg text-white/60 hover:text-white">
          <span aria-hidden="true">🔍</span>
        </Link>
      </div>

      {guest ? (
        <div className="sticky top-0 bg-black/90 backdrop-blur border-b border-white/10 px-4 py-2.5 z-10 flex items-center justify-center gap-2 text-sm">
          <span className="text-white/50">🌍 everyone&apos;s gist</span>
          <span className="text-white/20">•</span>
          <button onClick={() => router.push("/signup")} className="text-[#baff39] font-bold text-sm">
            join your school →
          </button>
        </div>
      ) : (
      <div className="sticky top-0 bg-black/90 backdrop-blur border-b border-white/10 px-2 grid grid-cols-4 z-10">
        {TABS.map((tab) => (
          <button
            key={tab.key}
            onClick={() => selectMode(tab.key)}
            title={tab.description}
            aria-label={`${tab.label}: ${tab.description}`}
            className={`text-sm py-3 text-center ${mode === tab.key ? "tab-active" : "tab-inactive"}`}
          >
            {tab.label}
          </button>
        ))}
      </div>
      )}
      {pullToRefresh && (
        <div className="fixed top-0 left-0 right-0 z-50 flex justify-center pt-4 pointer-events-none">
          <div className="bg-black/80 backdrop-blur border border-white/10 rounded-full px-4 py-2 text-sm text-primary font-medium animate-pulse">
            release to refresh
          </div>
        </div>
      )}
      {!loading && pendingPosts.length > 0 && (
        <div className="fixed top-16 left-0 right-0 z-30 flex justify-center pointer-events-none">
          <button
            onClick={showNewPosts}
            className="pointer-events-auto bg-primary text-black text-xs font-bold rounded-full px-4 py-2 shadow-lg hover:brightness-110 active:scale-95 transition-transform"
          >
            ↑ {pendingPosts.length} new gist{pendingPosts.length !== 1 ? "s" : ""} — tap to load
          </button>
        </div>
      )}

      {!loading && guest && (
        <div className="mx-4 mt-3 rounded-xl border border-[#baff39]/30 bg-[#baff39]/[0.06] p-3 flex items-center gap-3">
          <span className="text-xl">👻</span>
          <div className="flex-1 min-w-0">
            <p className="font-bold text-sm">you&apos;re browsing as a guest</p>
            <p className="text-xs text-white/50">join with your school email to post, vote & comment.</p>
          </div>
          <button onClick={() => router.push("/signup")} className="btn-primary text-xs px-3 py-1.5 shrink-0">join</button>
        </div>
      )}
      {!loading && !guest && showInviteNudge && me?.inviteCode && (
        <div className="mx-4 mt-3 rounded-xl border border-[#baff39]/30 bg-[#baff39]/[0.06] p-3 flex items-center gap-3">
          <span className="text-xl">👥</span>
          <div className="flex-1 min-w-0">
            <p className="font-bold text-sm">yard is better with your people</p>
            <p className="text-xs text-white/50">every verified signup with your link earns you credits.</p>
          </div>
          <button onClick={copyInviteLink} className="btn-primary text-xs px-3 py-1.5 shrink-0">
            {inviteCopied ? "✓" : "copy link"}
          </button>
          <button onClick={dismissInviteNudge} aria-label="dismiss" className="text-white/30 hover:text-white/60 text-sm shrink-0 px-1">✕</button>
        </div>
      )}
      {!loading && <SmartNudge />}
      {rushStatus.live && (
        <div className="mx-4 mt-3 rounded-xl border border-[#facc15]/40 bg-[#facc15]/[0.07] p-3 flex items-center gap-3 animate-pulse">
          <span className="text-xl">🔥</span>
          <div className="flex-1 min-w-0">
            <p className="font-bold text-sm text-[#facc15]">rush hour — votes earn 2x</p>
            <p className="text-xs text-white/50">ends in {rushMinsLeft}m • post + vote now</p>
          </div>
          <button onClick={() => router.push(guest ? "/signup" : "/compose")} className="btn-primary text-xs px-3 py-1.5 shrink-0">post</button>
        </div>
      )}
      {!loading && me && me.cohortYear == null && (
        <CohortPrompt
          onSaved={(year) => {
            setMe((prev) => (prev ? { ...prev, cohortYear: year } : prev))
            loadFeed()
          }}
        />
      )}

      {loading ? (
        <div>
          <PostSkeleton />
          <PostSkeleton />
          <PostSkeleton />
          <PostSkeleton />
          <PostSkeleton />
        </div>
      ) : posts.length === 0 ? (
        <div className="text-center mt-14 px-8">
          <p className="text-3xl mb-3">👻</p>
          <p className="text-white/50 text-sm">{EMPTY_MESSAGES[mode]}</p>
        </div>
      ) : (
        <div>
          {posts.map((post) => {
            const isOwn = me && post.user.id === me.id
            const isFollowing = followingByAuthor[post.user.id] ?? post.isFollowing
            const followPending = pendingFollows.has(post.user.id)
            const images = post.imageUrls && post.imageUrls.length > 0 ? post.imageUrls : (post.imageUrl ? [post.imageUrl] : [])

            const expanded = expandedId === post.id
            const isLong = (post.text?.length ?? 0) > 280
            return (
              <motion.article
                key={post.id}
                layout
                onClick={() => toggleExpand(post.id)}
                role="button"
                tabIndex={0}
                aria-expanded={expanded}
                onKeyDown={(e) => {
                  if (e.key === "Enter" || e.key === " ") {
                    e.preventDefault()
                    toggleExpand(post.id)
                  }
                }}
                data-post-id={post.id}
                className={`relative px-4 py-3 border-b border-white/[0.06] hover:bg-white/[0.02] cursor-pointer select-none focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-[#baff39] touch-manipulation ${expanded ? "bg-white/[0.03]" : ""}`}
              >
                <div className="flex items-start gap-3">
                  <Link
                    href={`/u/${encodeURIComponent(post.user.ghostId)}`}
                    aria-label={`view ${post.user.ghostId}'s profile`}
                    onClick={(e) => e.stopPropagation()}
                    className="flex-shrink-0 focus-visible:outline-[#baff39]"
                  >
                    <Avatar emoji={post.user.avatarEmoji} size={40} />
                  </Link>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 flex-wrap text-sm">
                      <Link
                        href={`/u/${encodeURIComponent(post.user.ghostId)}`}
                        aria-label={`view ${post.user.ghostId}'s profile`}
                        onClick={(e) => e.stopPropagation()}
                        className="font-semibold focus-visible:outline-[#baff39]"
                      >
                        {post.user.ghostId}
                      </Link>
                      {post.user.tier === "PLUS" && <span className="badge badge-plus">✓ plus</span>}
                      {post.user.tier === "PRIME" && <span className="badge badge-prime">👑 prime</span>}
                      <ChampionTrophies trophies={post.user.championTrophies} />
                      {post.boosted && <span className="badge badge-boosted">boosted</span>}
                      {post.pinned && <span className="badge badge-boosted">📌 pinned</span>}
                      {post.heating && <span className="badge badge-heating" title="lots of replies right now">🔥 heating</span>}
                      {post.freshLove && <span className="badge badge-fresh" title="fresh post getting its first eyes">✨ fresh</span>}
                      <span className="text-white/30">· {timeAgo(post.createdAt)}</span>
                    </div>

                    {post.text && (
                      <motion.div
                        initial={false}
                        animate={{ height: expanded ? "auto" : undefined }}
                        transition={{ duration: 0.28, ease: [0.2, 0.8, 0.2, 1] }}
                        className="overflow-hidden"
                      >
                        <p
                          className={`post-mono text-white/90 mt-1 whitespace-pre-wrap leading-relaxed text-base ${expanded ? "" : "clamp-3 line-clamp-3"}`}
                          style={{ lineHeight: 1.5 }}
                        >
                          <RichText text={post.text} />
                        </p>
                        {!expanded && isLong && <span className="text-xs text-white/40">… show more</span>}
                      </motion.div>
                    )}

                    {images.length > 0 && (
                      <div className="mt-2 grid gap-1" style={{
                        gridTemplateColumns: images.length === 1 ? '1fr' : images.length === 2 ? '1fr 1fr' : images.length === 3 ? '1fr 1fr' : '1fr 1fr',
                        gridTemplateRows: images.length === 3 ? '1fr 1fr' : images.length === 4 ? '1fr 1fr' : 'auto'
                      }}>
                        {images.map((img, idx) => (
                          <div
                            key={idx}
                            onClick={(e) => e.stopPropagation()}
                            className="relative aspect-video rounded-xl overflow-hidden bg-white/5 border border-white/10"
                            style={{
                              gridColumn: images.length === 3 && idx === 0 ? 'span 2' : images.length === 4 && idx < 2 ? undefined : undefined,
                              gridRow: images.length === 3 && idx === 0 ? 'span 2' : undefined,
                              aspectRatio: images.length === 1 ? '16/9' : images.length === 3 && idx === 0 ? '1/1' : '16/9'
                            }}
                          >
                            <OptimizedImage
                              src={img}
                              alt=""
                              fill
                              sizes="(max-width: 768px) 100vw, 50vw"
                              rounded
                            />
                          </div>
                        ))}
                      </div>
                    )}

                    <div className="flex flex-wrap items-center gap-x-5 gap-y-2 text-sm text-white/70 pt-2 [&_button]:inline-flex [&_button]:items-center [&_button]:shrink-0 [&_button]:focus-visible:outline-[#baff39]">
                      {isOwn ? (
                        <span onClick={(e) => e.stopPropagation()} className="inline-flex items-center gap-1 text-orange-200">🔥 {post.yeahs}</span>
                      ) : (
                        <button
                          onClick={(e) => {
                            e.stopPropagation()
                            handleVote(post.id)
                          }}
                          disabled={pendingVotes.current.has(post.id) || votedIds.has(post.id)}
                          aria-pressed={votedIds.has(post.id)}
                          aria-label={`add heat, ${post.yeahs} heat`}
                          className={`gap-1 touch-manipulation transition-transform will-change-transform ${poppingId === post.id ? "animate-fire-pop text-orange-100" : "text-orange-200 hover:text-orange-100"} disabled:opacity-60 active:scale-95`}
                        >
                          <span className={`${poppingId === post.id ? "inline-block animate-fire-pop" : "inline-block"}`}>🔥</span>
                          <span className={`${poppingId === post.id ? "inline-block animate-count-tick" : ""}`}>{post.yeahs}</span>
                        </button>
                      )}
                      <button
                        onClick={(e) => {
                          e.stopPropagation()
                          toggleExpand(post.id)
                        }}
                        aria-expanded={expanded}
                        aria-label={`view comments, ${post.commentsCount} comments`}
                        className="text-sky-200 hover:text-sky-100 gap-1 touch-manipulation"
                      >
                        💬 {post.commentsCount}
                      </button>
                      {isOwn && (
                        <button onClick={(e) => { e.stopPropagation(); handleBoost(post.id) }} className="hover:text-primary touch-manipulation" title="boost 24h">
                          🚀
                        </button>
                      )}
                      {isOwn && !post.pinned && (
                        <button onClick={(e) => { e.stopPropagation(); handlePin(post.id) }} className="hover:text-primary touch-manipulation" title="pin top of campus for 1hr — 1000 credits">
                          📌
                        </button>
                      )}
                      {isOwn && (
                        <button
                          onClick={(e) => { e.stopPropagation(); toggleHints(post.id) }}
                          aria-expanded={hintsOpenId === post.id}
                          aria-label="who viewed and voted"
                          className="hover:text-primary gap-1 touch-manipulation"
                          title="who is watching 👀"
                        >
                          👀
                        </button>
                      )}
                      {!isOwn && (
                        <button
                          onClick={(e) => { e.stopPropagation(); handleFollow(post.user.id) }}
                          disabled={followPending}
                          aria-label={`${isFollowing ? "unfollow" : "follow"} ${post.user.ghostId}`}
                          aria-pressed={isFollowing}
                          aria-busy={followPending}
                          title={isFollowing ? "following" : "follow"}
                          className={`${isFollowing ? "text-primary" : "text-white/90"} hover:text-primary disabled:opacity-50 disabled:cursor-wait touch-manipulation`}
                        >
                          <svg aria-hidden="true" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                            <path d={isFollowing ? "M5 12l4 4L19 6" : "M12 5v14M5 12h14"} />
                          </svg>
                        </button>
                      )}
                      {isOwn && me && me.tier !== "FREE" && (
                        <button onClick={(e) => { e.stopPropagation(); handleEdit(post.id, post.text) }} className="hover:text-primary touch-manipulation">
                          ✎
                        </button>
                      )}
                      {isOwn && (
                        <button onClick={(e) => { e.stopPropagation(); handleDelete(post.id) }} className="hover:text-red-400 touch-manipulation">
                          🗑
                        </button>
                      )}
                      {!isOwn && (
                        <button onClick={(e) => { e.stopPropagation(); handleReport(post.id) }} className="hover:text-white/70 ml-auto text-xs touch-manipulation">
                          ⚑
                        </button>
                      )}
                    </div>

                    {isOwn && hintsOpenId === post.id && (
                      <div className="mt-2 rounded-xl border border-white/10 bg-white/[0.03] p-3" onClick={(e) => e.stopPropagation()}>
                        {hintsLoading[post.id] ? (
                          <p className="text-xs text-white/30">reading the room...</p>
                        ) : !hintsData[post.id] ? (
                          <p className="text-xs text-white/30">couldn't load hints.</p>
                        ) : (
                          <div>
                            <p className="text-xs text-white/60 mb-2">
                              👁 {hintsData[post.id].views} views · 🔥 {hintsData[post.id].heats} heats
                            </p>
                            {hintsData[post.id].byProgram ? (
                              <div className="space-y-1 mb-1">
                                {hintsData[post.id].byProgram!.slice(0, 5).map((r) => (
                                  <p key={r.program} className="text-xs text-white/50">
                                    {r.program} — 👁 {r.views} · 🔥 {r.heats}
                                  </p>
                                ))}
                              </div>
                            ) : (
                              <p className="text-xs text-white/30 mb-1">plus shows which programs are watching.</p>
                            )}
                            {hintsData[post.id].byYear && (
                              <div className="space-y-1 mb-1">
                                {hintsData[post.id].byYear!.slice(0, 5).map((r) => (
                                  <p key={r.cohortYear} className="text-xs text-white/50">
                                    class of {r.cohortYear} — 👁 {r.views} · 🔥 {r.heats}
                                  </p>
                                ))}
                              </div>
                            )}
                            {hintsData[post.id].followerContext && (
                              <p className="text-xs text-white/40">
                                {hintsData[post.id].followerContext!.followingYou} follow you · you follow {hintsData[post.id].followerContext!.youFollow}
                              </p>
                            )}
                          </div>
                        )}
                      </div>
                    )}

                    <AnimatePresence initial={false}>
                      {expanded && (
                        <motion.div
                          initial={{ opacity: 0, height: 0 }}
                          animate={{ opacity: 1, height: "auto" }}
                          exit={{ opacity: 0, height: 0 }}
                          transition={{ duration: 0.22, ease: "easeInOut" }}
                          className="overflow-hidden"
                          onClick={(e) => e.stopPropagation()}
                        >
                          <div className="mt-3 pt-3 border-t border-white/10 -mx-4 px-4 bg-white/[0.02] rounded-b-xl">
                            <div className="flex items-center justify-between mb-2">
                              <span className="text-xs text-white/40">{post.commentsCount} comment{post.commentsCount !== 1 ? "s" : ""}</span>
                              <Link href={`/post/${post.id}`} onClick={(e) => e.stopPropagation()} className="text-xs font-semibold text-primary hover:text-primary">
                                open thread →
                              </Link>
                            </div>
                            {inlineLoading[post.id] ? (
                              <p className="text-xs text-white/30 py-2">loading comments...</p>
                            ) : (inlineComments[post.id]?.length ?? 0) === 0 ? (
                              <p className="text-xs text-white/30 py-2">no comments yet — be first.</p>
                            ) : (
                              <div className="space-y-2 max-h-64 overflow-y-auto no-scrollbar pr-1">
                                {inlineComments[post.id]?.slice(-3).map((c: InlineComment) => (
                                  <div key={c.id} className="flex gap-2 py-1.5">
                                    <Avatar emoji={c.user?.avatarEmoji || "💬"} size={24} />
                                    <div className="flex-1 min-w-0">
                                      <div className="flex items-center gap-2">
                                        <span className="font-semibold text-xs">{c.user?.ghostId || c.ghostId}</span>
                                        {c.user?.tier === "PLUS" && <span className="badge badge-plus text-[10px]">✓ plus</span>}
                                        {c.user?.tier === "PRIME" && <span className="badge badge-prime text-[10px]">👑 prime</span>}
                                        <ChampionTrophies trophies={c.user?.championTrophies} className="text-[10px] leading-none" />
                                        <span className="text-[11px] text-white/40">{timeAgo(c.createdAt)}</span>
                                      </div>
                                      <p className="post-mono text-sm text-white/90 line-clamp-2">{c.text}</p>
                                    </div>
                                  </div>
                                ))}
                                {post.commentsCount > 3 && (inlineComments[post.id]?.length || 0) >= 3 && (
                                  <p className="text-xs text-white/30">+{post.commentsCount - 3} more in thread</p>
                                )}
                              </div>
                            )}
                            <div className="flex gap-2 mt-3">
                              <input
                                className="input flex-1 h-9 text-sm"
                                placeholder="add a comment..."
                                value={inlineDraft[post.id] || ""}
                                onChange={(e) => setInlineDraft((s) => ({ ...s, [post.id]: e.target.value.toLowerCase() }))}
                                onKeyDown={(e) => e.key === "Enter" && handleInlineSubmit(post.id)}
                              />
                              <button
                                className="btn-primary px-4 h-9 text-sm touch-manipulation disabled:opacity-50"
                                onClick={() => handleInlineSubmit(post.id)}
                                disabled={inlineSubmitting[post.id] || !inlineDraft[post.id]?.trim()}
                              >
                                {inlineSubmitting[post.id] ? "..." : "send"}
                              </button>
                            </div>
                            <Link href={`/post/${post.id}`} onClick={(e) => e.stopPropagation()} className="inline-block mt-2 mb-1 text-[11px] text-white/30 hover:text-white/50">
                              view all comments →
                            </Link>
                          </div>
                        </motion.div>
                      )}
                    </AnimatePresence>
                  </div>
                </div>
              </motion.article>
            )
          })}
          {loadingMore && <p className="text-center text-white/30 text-sm py-4">loading more...</p>}
          {nextCursor && <div ref={loadMoreRef} className="h-8" aria-hidden="true" />}
          {!loadingMore && !nextCursor && (
            <div className="text-center px-8 py-10">
              <p className="text-3xl mb-2">👻</p>
              {guest ? (
                <>
                  <p className="font-bold text-white/80 text-sm">want in on the gist?</p>
                  <p className="text-white/40 text-xs mt-1 mb-4">join with your school email to post, vote & comment.</p>
                  <button onClick={() => router.push("/signup")} className="btn-primary text-xs px-6">join yard</button>
                </>
              ) : (
                <>
                  <p className="font-bold text-white/80 text-sm">you&apos;re all caught up</p>
                  <p className="text-white/40 text-xs mt-1 mb-4">fresh gist lands all day — check battles or start one.</p>
                  <div className="flex gap-2 justify-center flex-wrap">
                    <button onClick={() => router.push("/battles")} className="btn-ghost text-xs">⚔️ battles</button>
                    <button onClick={() => router.push("/explore")} className="btn-ghost text-xs">🔥 trending</button>
                    <button onClick={() => router.push("/compose")} className="btn-primary text-xs px-4">+ gist</button>
                  </div>
                  <button onClick={() => router.push("/lair")} className="text-white/40 hover:text-[#baff39] text-xs mt-3">
                    seen everything? invite your hostel →
                  </button>
                </>
              )}
            </div>
          )}
        </div>
      )}

      <button
        onClick={() => router.push(guest ? "/signup" : "/compose")}
        aria-label={guest ? "join yard to post" : "compose post"}
        className="fixed bottom-24 right-5 w-14 h-14 rounded-full bg-primary text-black text-2xl flex items-center justify-center shadow-[0_8px_24px_var(--accent-glow)] z-20"
      >
        ✏️
      </button>

      {showDrawer && me && (
        <div className="fixed inset-0 z-50 flex">
          <div className="w-72 bg-black border-r border-white/10 flex flex-col overflow-hidden">
            <div className="flex-1 overflow-y-auto p-5 no-scrollbar">
              <div className="flex items-center gap-3 mb-3">
                <div className="relative w-14 h-14 flex-shrink-0">
                  <Avatar emoji={me.avatarEmoji} size={56} />
                </div>
                <div className="flex-1 min-w-0">
                  <p className="font-bold truncate flex items-center gap-1.5">{me.ghostId} {me.tier === "PLUS" && <span className="badge badge-plus text-[10px]">✓ plus</span>}{me.tier === "PRIME" && <span className="badge badge-prime text-[10px]">👑 prime</span>}<ChampionTrophies trophies={me.championTrophies} className="text-[10px] leading-none" /></p>
                  <p className="text-xs text-white/40 truncate">{me.campus}</p>
                  {me.tier !== "FREE" && me.tierDaysLeft != null && <p className="text-[11px] text-white/30">{me.isTrial ? `trial — ${me.tierDaysLeft}d left` : `${me.tierDaysLeft}d left • auto-renew on`}</p>}
                </div>
              </div>

              <div className="flex gap-4 mb-3 text-sm">
                <div><span className="font-bold">{me.followingCount}</span> <span className="text-white/40">following</span></div>
                <div><span className="font-bold">{me.followersCount}</span> <span className="text-white/40">followers</span></div>
                <div className="ml-auto flex items-center gap-1 text-xs text-white/30"><span>🔥 {me.streakCount}</span></div>
              </div>

              {me.tier === "PRIME" && (
                <div className="card p-3 mb-3 border-[#facc15]/25 bg-[#facc15]/[0.06]">
                  <p className="text-[10px] font-bold tracking-widest text-[#facc15]/80 uppercase mb-1">👑 prime</p>
                  <p className="text-xs text-white/60 mb-2">gold everything + credit rewards. enjoy!</p>
                  <p className="text-[11px] text-white/25 mt-1.5 text-center">{me.tierDaysLeft!=null?`${me.tierDaysLeft}d left`:''} • {me.storageUsed?.toFixed(0)}/{me.storageLimit} mb</p>
                </div>
              )}
              {me.tier === "PLUS" && (
                <div className="card p-3 mb-3 border-primary/20 bg-primary/[0.06]">
                  <p className="text-[10px] font-bold tracking-widest text-primary/70 uppercase mb-1">{me.isTrial ? "plus trial" : "plus"}</p>
                  <p className="text-xs text-white/60 mb-2">{me.isTrial ? "free week — enjoy the checkmark while it lasts." : "you have edits, avatars & priority. prime adds gold + credit rewards."}</p>
                  <button className="w-full text-xs font-bold text-[#facc15] border border-[#facc15]/30 rounded-xl py-2 hover:bg-[#facc15]/10" onClick={() => { logPaywallHit("upgrade_view", "/feed").catch(()=>{}); setShowDrawer(false); router.push("/upgrade") }}>{me.isTrial ? "keep plus — ghs 10/mo" : "go prime — ghs 20/mo"}</button>
                  <p className="text-[11px] text-white/25 mt-1.5 text-center">{me.tierDaysLeft!=null?`${me.isTrial ? "trial — " : ""}${me.tierDaysLeft}d left`:''} • {me.storageUsed?.toFixed(0)}/{me.storageLimit} mb</p>
                </div>
              )}
              {me.tier === "FREE" && (
                <div className="card p-3 mb-3 border-primary/20 bg-primary/[0.06]">
                  <p className="text-[10px] font-bold tracking-widest text-primary/70 uppercase mb-2">go plus</p>
                  <p className="text-xs text-white/60 mb-2">edits, avatars, blue checkmark & priority</p>
                  <button className="btn-primary w-full text-xs" onClick={() => { logPaywallHit("upgrade_view", "/feed").catch(()=>{}); setShowDrawer(false); router.push("/upgrade") }}>upgrade — ghs 10/mo</button>
                </div>
              )}
              {/* Free: nothing else — just nav below */}

              <div className="space-y-1">
                <button className="w-full text-left py-2.5 px-3 rounded-xl hover:bg-white/5 text-sm flex items-center gap-2" onClick={() => { setShowDrawer(false); router.push("/lair") }}>👻 my lair <span className="ml-auto text-white/20">›</span></button>
                <button className="w-full text-left py-2.5 px-3 rounded-xl hover:bg-white/5 text-sm flex items-center gap-2" onClick={() => { setShowDrawer(false); router.push("/shop") }}>🛍️ shop <span className="ml-auto text-white/20">›</span></button>
                <button className="w-full text-left py-2.5 px-3 rounded-xl hover:bg-white/5 text-sm flex items-center gap-2" onClick={() => { setShowDrawer(false); router.push("/leaderboard") }}>🏆 leaderboard <span className="ml-auto text-white/20">›</span></button>
                <button className="w-full text-left py-2.5 px-3 rounded-xl hover:bg-white/5 text-sm flex items-center gap-2" onClick={() => { setShowDrawer(false); router.push("/settings") }}>⚙️ settings <span className="ml-auto text-white/20">›</span></button>
                <button className="w-full text-left py-2.5 px-3 rounded-xl hover:bg-white/5 text-sm flex items-center gap-2" onClick={() => { setShowDrawer(false); setShowNameModal(true) }}>✏️ edit ghost name</button>
                <button className="w-full text-left py-2.5 px-3 rounded-xl hover:bg-white/5 text-sm flex items-center gap-2" onClick={openAvatarModal}>🎭 edit avatar</button>
              </div>
            </div>
            <div className="p-4 border-t border-white/10">
              <button className="btn-ghost w-full" onClick={handleLogout}>log out</button>
            </div>
          </div>
          <div className="flex-1 bg-black/60" onClick={() => setShowDrawer(false)} />
        </div>
      )}

      {showAvatarModal && (
        <div className="fixed inset-0 bg-black/70 flex items-center justify-center z-50 px-4">
          <div className="card p-5 w-full max-w-sm bg-black">
            <h3 className="font-bold text-lg mb-1">pick your avatar</h3>
            <p className="text-white/50 text-sm mb-4">unlocked by tier or purchased in the shop.</p>
            <div className="grid grid-cols-4 gap-3 mb-4">
              {availableAvatars.map((emoji) => (
                <button
                  key={emoji}
                  onClick={() => handlePickAvatar(emoji)}
                  className="relative w-14 h-14 mx-auto hover:bg-primary/20"
                >
                  <Avatar emoji={emoji} size={56} />
                </button>
              ))}
            </div>
            <button className="btn-ghost w-full" onClick={() => setShowAvatarModal(false)}>
              cancel
            </button>
          </div>
        </div>
      )}

      {showNameModal && (
        <div className="fixed inset-0 bg-black/70 flex items-center justify-center z-50 px-4">
          <div className="card p-5 w-full max-w-sm bg-black">
            <h3 className="font-bold text-lg mb-1">change your ghost name</h3>
            <p className="text-white/50 text-sm mb-4">500 credits — credits only, no cash.</p>
            <input className="input mb-3" placeholder="new ghost name" value={newName} onChange={(e) => setNewName(e.target.value)} maxLength={24} />
            <div className="flex gap-2">
              <button className="btn-ghost flex-1" onClick={() => setShowNameModal(false)}>cancel</button>
              <button className="btn-primary flex-1" onClick={handleNameChange}>change for 500</button>
            </div>
          </div>
        </div>
      )}
    </main>
  )
}