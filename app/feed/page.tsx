"use client"

import { useCallback, useEffect, useRef, useState } from "react"
import { useRouter } from "next/navigation"
import Link from "next/link"
import { motion, AnimatePresence } from "framer-motion"
import { apiGet, apiPost, apiDelete, apiPatch } from "@/lib/useApi"
import { timeAgo } from "@/lib/timeAgo"
import { openPaystackCheckout } from "@/lib/purchaseGate"
import { BarChart, Bar, ResponsiveContainer, XAxis } from "recharts"
import RichText from "@/app/components/RichText"
import { useSocket } from "@/lib/socket"
import OptimizedImage from "@/app/components/OptimizedImage"
import Avatar from "@/app/components/Avatar"

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
  isFollowing: boolean
  createdAt: string
  user: { id: string; ghostId: string; avatarEmoji: string; tier: string }
}

type Me = {
  id: string
  ghostId: string
  avatarEmoji: string
  campus: string
  tier: string
  rawTier?: string
  tierExpiresAt?: string | null
  tierDaysLeft?: number | null
  streakCount: number
  followersCount: number
  followingCount: number
  totalEarnedPesewas?: number
  availableBalancePesewas?: number
  hasPendingPayout?: boolean
  storageUsed?: number
  storageLimit?: number
  ghostCoins?: number
}

const TABS = [
  { key: "campus", label: "For You", description: "Posts from your school/program" },
  { key: "following", label: "Following", description: "Posts from ghosts you follow" },
  { key: "all", label: "All", description: "Posts from every school" },
  { key: "program", label: "Class", description: "Posts from your program only" },
]

const EMPTY_MESSAGES: Record<string, string> = {
  campus: "No posts from your school/program yet",
  following: "No posts from your school/program yet",
  all: "No posts from any school yet",
  program: "No posts from your program yet — be first in Class",
}

export default function FeedPage() {
  const router = useRouter()
  const [me, setMe] = useState<Me | null>(null)
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
  const [primeEarnings, setPrimeEarnings] = useState<{ date: string; total: number }[] | null>(null)
  const [pullToRefresh, setPullToRefresh] = useState(false)
  const pullStartRef = useRef<number | null>(null)

  // Expand + inline comments (X-style tap anywhere)
  const [expandedId, setExpandedId] = useState<string | null>(null)
  const [inlineComments, setInlineComments] = useState<Record<string, any[]>>({})
  const [inlineLoading, setInlineLoading] = useState<Record<string, boolean>>({})
  const [inlineDraft, setInlineDraft] = useState<Record<string, string>>({})
  const [inlineSubmitting, setInlineSubmitting] = useState<Record<string, boolean>>({})
  // Heat optimistic + animation
  const [votedIds, setVotedIds] = useState<Set<string>>(new Set())
  const [poppingId, setPoppingId] = useState<string | null>(null)
  const pendingVotes = useRef(new Set<string>())

  const { connected, on, joinCampus, leaveCampus } = useSocket()

  const loadMe = useCallback((isCurrent: () => boolean = () => true) => {
    return apiGet("/api/auth/me")
      .then((data) => {
        if (!data.user) {
          if (isCurrent()) router.push("/login")
          return
        }
        if (isCurrent()) setMe(data.user)
      })
      .catch(() => {
        if (isCurrent()) router.push("/login")
      })
  }, [router])

  function newRefreshSeed() {
    return `${Date.now().toString(36)}${Math.random().toString(36).slice(2)}`
  }

  function loadFeed() {
    setLoading(true)
    setLoadingMore(false)
    setRefreshSeed(newRefreshSeed())
    setFeedVersion((version) => version + 1)
  }

  function selectMode(nextMode: string) {
    if (nextMode === mode) return
    setLoading(true)
    setLoadingMore(false)
    setRefreshSeed(newRefreshSeed())
    setMode(nextMode)
  }

  useEffect(() => {
    let active = true
    loadMe(() => active)
    return () => { active = false }
  }, [loadMe])

  // Prime earnings chart for drawer
  useEffect(() => {
    if (me?.tier !== "PRIME") return
    let active = true
    apiGet("/api/analytics/earnings?range=7d&period=day").then((d) => {
      if (!active || !d.byDate) return
      const mapped = d.byDate.map((r: any) => ({ date: r.date.slice(5), total: r.total / 100 }))
      setPrimeEarnings(mapped.length ? mapped : null)
    }).catch(() => {})
    return () => { active = false }
  }, [me?.tier])

  useEffect(() => {
    let active = true
    apiGet(`/api/posts?mode=${mode}&seed=${refreshSeed}`)
      .then((data) => {
        if (!active) return
        setPosts(data.posts)
        setNextCursor(data.nextCursor)
      })
      .catch((err: unknown) => {
        if (!active) return
        if (err instanceof Error && err.message === "Not authenticated.") {
          router.push("/login")
          return
        }
        console.error(err)
      })
      .finally(() => {
        if (active) setLoading(false)
      })
    return () => { active = false }
  }, [mode, feedVersion, refreshSeed, router])

  useEffect(() => {
    if (loading || !nextCursor) return
    let active = true
    let pending = false

    async function loadMore() {
      if (pending) return
      pending = true
      setLoadingMore(true)
      try {
        const data = await apiGet(`/api/posts?mode=${mode}&cursor=${nextCursor}&seed=${refreshSeed}`)
        if (!active) return
        setPosts((prev) => [...prev, ...data.posts])
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
    window.addEventListener("scroll", handleScroll)
    return () => {
      active = false
      window.removeEventListener("scroll", handleScroll)
    }
  }, [nextCursor, loading, mode, feedVersion, refreshSeed])

  useEffect(() => {
    if (!connected) return
    const unsubNewPost = on("new_post", (post: any) => {
      if (mode === "campus" && post.campus === me?.campus) {
        setPosts((prev) => [post as Post, ...prev])
      }
    })
    const unsubVote = on("vote_update", ({ postId, yeahs }: { postId: string; yeahs: number }) => {
      setPosts((prev) => prev.map((p) => (p.id === postId ? { ...p, yeahs } : p)))
    })
    const unsubComment = on("comment_added", ({ postId, comment }: { postId: string; comment: any }) => {
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
    if (pendingVotes.current.has(postId) || votedIds.has(postId)) return
    const prev = posts.find((p) => p.id === postId)
    if (!prev) return
    pendingVotes.current.add(postId)
    setVotedIds((s) => new Set(s).add(postId))
    setPosts((prevPs) => prevPs.map((p) => (p.id === postId ? { ...p, yeahs: p.yeahs + 1 } : p)))
    setPoppingId(postId)
    setTimeout(() => setPoppingId((c) => (c === postId ? null : c)), 420)
    try {
      const res: any = await apiPost(`/api/posts/${postId}/vote`, {})
      if (res?.post?.yeahs != null) {
        setPosts((ps) => ps.map((p) => (p.id === postId ? { ...p, yeahs: res.post.yeahs } : p)))
      }
    } catch (err: unknown) {
      // revert on error (already voted / own post / network)
      setPosts((ps) => ps.map((p) => (p.id === postId ? { ...p, yeahs: prev.yeahs } : p)))
      setVotedIds((s) => {
        const n = new Set(s)
        n.delete(postId)
        return n
      })
      const msg = err instanceof Error ? err.message : "Something went wrong."
      if (!msg.includes("already voted")) alert(msg)
    } finally {
      pendingVotes.current.delete(postId)
    }
  }

  async function toggleExpand(postId: string) {
    if (expandedId === postId) {
      setExpandedId(null)
      return
    }
    setExpandedId(postId)
    if (inlineComments[postId]) return
    setInlineLoading((s) => ({ ...s, [postId]: true }))
    try {
      const data: any = await apiGet(`/api/posts/${postId}/comments`)
      setInlineComments((s) => ({ ...s, [postId]: data.comments || [] }))
    } catch (e) {
      console.error(e)
    } finally {
      setInlineLoading((s) => ({ ...s, [postId]: false }))
    }
  }

  async function handleInlineSubmit(postId: string) {
    const text = inlineDraft[postId]?.trim()
    if (!text || !me) return
    const tempId = `temp-${Date.now()}`
    const optimistic: any = {
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
      const data: any = await apiPost(`/api/posts/${postId}/comments`, { text, parentId: null })
      const real = data.comment || data
      setInlineComments((s) => ({
        ...s,
        [postId]: (s[postId] || []).map((c) => (c.id === tempId ? { ...real, replies: real.replies || [] } : c)),
      }))
    } catch (err: unknown) {
      setInlineComments((s) => ({ ...s, [postId]: (s[postId] || []).filter((c) => c.id !== tempId) }))
      setPosts((prev) => prev.map((p) => (p.id === postId ? { ...p, commentsCount: Math.max(0, p.commentsCount - 1) } : p)))
      setInlineDraft((s) => ({ ...s, [postId]: text }))
      alert(err instanceof Error ? err.message : "Failed to comment")
    } finally {
      setInlineSubmitting((s) => ({ ...s, [postId]: false }))
    }
  }

  async function handleBoost(postId: string) {
    try {
      await apiPost(`/api/boost/${postId}`, {})
      alert("Boosted for 24h!")
      loadFeed()
    } catch (err: unknown) {
      if (err instanceof Error && err.message.includes("Buy")) {
        if (confirm("No boost credits left. Go buy some in the Shop?")) router.push("/shop")
      } else {
        alert(err instanceof Error ? err.message : "Something went wrong.")
      }
    }
  }

  async function handleFollow(targetUserId: string) {
    if (!me || pendingFollowRequests.current.has(targetUserId)) return
    pendingFollowRequests.current.add(targetUserId)
    setPendingFollows(new Set(pendingFollowRequests.current))
    try {
      const data = await apiPost("/api/follow", { targetUserId })
      setFollowingByAuthor((prev) => ({ ...prev, [targetUserId]: data.following }))
      setPosts((prev) => prev.map((post) => post.user.id === targetUserId ? { ...post, isFollowing: data.following } : post))
      loadMe()
    } catch (err: unknown) {
      alert(err instanceof Error ? err.message : "Something went wrong.")
    } finally {
      pendingFollowRequests.current.delete(targetUserId)
      setPendingFollows(new Set(pendingFollowRequests.current))
    }
  }

  async function handleReport(postId: string) {
    const reason = prompt("Why are you reporting this post?")
    if (!reason?.trim()) return
    try {
      await apiPost("/api/reports", { postId, reason })
      alert("Reported — this post is now hidden pending review.")
      loadFeed()
    } catch (err: unknown) {
      alert(err instanceof Error ? err.message : "Something went wrong.")
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
    if (!confirm("Delete this post?")) return
    try {
      await apiDelete(`/api/posts/${postId}`)
      setPosts((prev) => prev.filter((p) => p.id !== postId))
    } catch (err: unknown) {
      alert(err instanceof Error ? err.message : "Something went wrong.")
    }
  }

  async function handleEdit(postId: string, currentText: string | null) {
    const newText = prompt("Edit your post:", currentText || "")
    if (newText === null || !newText.trim()) return
    try {
      await apiPatch(`/api/posts/${postId}`, { text: newText })
      setPosts((prev) => prev.map((p) => (p.id === postId ? { ...p, text: newText } : p)))
    } catch (err: unknown) {
      alert(err instanceof Error ? err.message : "Something went wrong.")
    }
  }

  async function handleNameChange() {
    if (!newName.trim()) return
    try {
      const data = await apiPost("/api/shop/custom-name", { newName })
      if (data.data?.authorization_url) await openPaystackCheckout(data.data.authorization_url)
    } catch (err: unknown) {
      alert(err instanceof Error ? err.message : "Something went wrong.")
    }
  }

  async function openAvatarModal() {
    try {
      const data = await apiGet("/api/profile/avatar")
      setAvailableAvatars(data.available)
      setShowDrawer(false)
      setShowAvatarModal(true)
    } catch (err: unknown) {
      alert(err instanceof Error ? err.message : "Something went wrong.")
    }
  }

  async function handlePickAvatar(emoji: string) {
    try {
      await apiPost("/api/profile/avatar", { emoji })
      setShowAvatarModal(false)
      loadMe()
    } catch (err: unknown) {
      alert(err instanceof Error ? err.message : "Something went wrong.")
    }
  }

  async function handleLogout() {
    try {
      await fetch("/api/auth/logout", { method: "POST", credentials: "include" })
    } catch {}
    // Also clear client-side welcome cookie that was set via document.cookie
    document.cookie = "yard_token=; Max-Age=0; path=/"
    document.cookie = "yard_seen_welcome=; Max-Age=0; path=/"
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
        <button onClick={() => setShowDrawer(true)} className="absolute left-4">
          <Avatar emoji={me?.avatarEmoji || "👻"} size={32} />
        </button>
        <span className="font-black text-lg tracking-tight">
          YARD<span className="text-primary">.</span>
        </span>
        <div className="absolute right-4 w-10" aria-hidden="true" />
      </div>

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
      {pullToRefresh && (
        <div className="fixed top-0 left-0 right-0 z-50 flex justify-center pt-4 pointer-events-none">
          <div className="bg-black/80 backdrop-blur border border-white/10 rounded-full px-4 py-2 text-sm text-primary font-medium animate-pulse">
            Release to refresh
          </div>
        </div>
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
                className={`relative px-4 py-3 border-b border-white/[0.06] hover:bg-white/[0.02] cursor-pointer select-none focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-[#baff39] touch-manipulation ${expanded ? "bg-white/[0.03]" : ""}`}
              >
                <div className="flex items-start gap-3">
                  <Link
                    href={`/u/${encodeURIComponent(post.user.ghostId)}`}
                    aria-label={`View ${post.user.ghostId}'s profile`}
                    onClick={(e) => e.stopPropagation()}
                    className="flex-shrink-0 focus-visible:outline-[#baff39]"
                  >
                    <Avatar emoji={post.user.avatarEmoji} size={40} />
                  </Link>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 flex-wrap text-sm">
                      <Link
                        href={`/u/${encodeURIComponent(post.user.ghostId)}`}
                        aria-label={`View ${post.user.ghostId}'s profile`}
                        onClick={(e) => e.stopPropagation()}
                        className="font-semibold focus-visible:outline-[#baff39]"
                      >
                        {post.user.ghostId}
                      </Link>
                      {post.user.tier === "PRIME" && <span className="badge badge-prime">✓ Prime</span>}
                      {post.boosted && <span className="badge badge-boosted">Boosted</span>}
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
                          className={`text-white/90 mt-1 whitespace-pre-wrap leading-relaxed text-base ${expanded ? "" : "clamp-3 line-clamp-3"}`}
                          style={{ lineHeight: 1.5 }}
                        >
                          <RichText text={post.text} />
                        </p>
                        {!expanded && isLong && <span className="text-xs text-white/40">… Show more</span>}
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
                          aria-label={`Add heat, ${post.yeahs} heat`}
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
                        aria-label={`View comments, ${post.commentsCount} comments`}
                        className="text-sky-200 hover:text-sky-100 gap-1 touch-manipulation"
                      >
                        💬 {post.commentsCount}
                      </button>
                      {isOwn && (
                        <button onClick={(e) => { e.stopPropagation(); handleBoost(post.id) }} className="hover:text-primary touch-manipulation">
                          🚀
                        </button>
                      )}
                      {!isOwn && (
                        <button
                          onClick={(e) => { e.stopPropagation(); handleFollow(post.user.id) }}
                          disabled={!me || followPending}
                          aria-label={`${isFollowing ? "Unfollow" : "Follow"} ${post.user.ghostId}`}
                          aria-pressed={isFollowing}
                          aria-busy={followPending}
                          title={isFollowing ? "Following" : "Follow"}
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
                                Open thread →
                              </Link>
                            </div>
                            {inlineLoading[post.id] ? (
                              <p className="text-xs text-white/30 py-2">Loading comments...</p>
                            ) : (inlineComments[post.id]?.length ?? 0) === 0 ? (
                              <p className="text-xs text-white/30 py-2">No comments yet — be first.</p>
                            ) : (
                              <div className="space-y-2 max-h-64 overflow-y-auto no-scrollbar pr-1">
                                {inlineComments[post.id]?.slice(-3).map((c: any) => (
                                  <div key={c.id} className="flex gap-2 py-1.5">
                                    <Avatar emoji={c.user?.avatarEmoji || "💬"} size={24} />
                                    <div className="flex-1 min-w-0">
                                      <div className="flex items-center gap-2">
                                        <span className="font-semibold text-xs">{c.user?.ghostId || c.ghostId}</span>
                                        <span className="text-[11px] text-white/40">{timeAgo(c.createdAt)}</span>
                                      </div>
                                      <p className="text-sm text-white/90 line-clamp-2">{c.text}</p>
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
                                placeholder="Add a comment..."
                                value={inlineDraft[post.id] || ""}
                                onChange={(e) => setInlineDraft((s) => ({ ...s, [post.id]: e.target.value }))}
                                onKeyDown={(e) => e.key === "Enter" && handleInlineSubmit(post.id)}
                              />
                              <button
                                className="btn-primary px-4 h-9 text-sm touch-manipulation disabled:opacity-50"
                                onClick={() => handleInlineSubmit(post.id)}
                                disabled={inlineSubmitting[post.id] || !inlineDraft[post.id]?.trim()}
                              >
                                {inlineSubmitting[post.id] ? "..." : "Send"}
                              </button>
                            </div>
                            <Link href={`/post/${post.id}`} onClick={(e) => e.stopPropagation()} className="inline-block mt-2 mb-1 text-[11px] text-white/30 hover:text-white/50">
                              View all comments →
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
          {loadingMore && <p className="text-center text-white/30 text-sm py-4">Loading more...</p>}
        </div>
      )}

      <button
        onClick={() => router.push("/compose")}
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
                  <p className="font-bold truncate flex items-center gap-1.5">{me.ghostId} {me.tier === "PRIME" && <span className="badge badge-prime text-[10px]">Prime</span>}{me.tier === "PLUS" && <span className="badge badge-boosted text-[10px]">Plus</span>}</p>
                  <p className="text-xs text-white/40 truncate">{me.campus}</p>
                  {me.tier !== "FREE" && me.tierDaysLeft != null && <p className="text-[11px] text-white/30">{me.tierDaysLeft}d left • auto-renew on</p>}
                </div>
              </div>

              <div className="flex gap-4 mb-3 text-sm">
                <div><span className="font-bold">{me.followingCount}</span> <span className="text-white/40">Following</span></div>
                <div><span className="font-bold">{me.followersCount}</span> <span className="text-white/40">Followers</span></div>
                <div className="ml-auto flex items-center gap-1 text-xs text-white/30"><span>🔥 {me.streakCount}</span></div>
              </div>

              {/* Prime — mini stats + earnings chart, no upgrade */}
              {me.tier === "PRIME" && (
                <div className="card p-3 mb-3 border-primary/20 bg-primary/[0.06]">
                  <p className="text-[10px] font-bold tracking-widest text-primary/70 uppercase mb-2">Prime • earnings</p>
                  <div className="grid grid-cols-2 gap-2">
                    <div className="bg-black/30 rounded-lg p-2 border border-white/5">
                      <p className="text-[10px] text-white/30">Earned</p>
                      <p className="text-sm font-black text-white">GHS {((me.totalEarnedPesewas||0)/100).toFixed(2)}</p>
                    </div>
                    <div className="bg-black/30 rounded-lg p-2 border border-white/5">
                      <p className="text-[10px] text-white/30">Balance</p>
                      <p className="text-sm font-black text-primary">GHS {((me.availableBalancePesewas||0)/100).toFixed(2)}</p>
                      {me.hasPendingPayout && <p className="text-[10px] text-amber-400">⏳ pending</p>}
                    </div>
                  </div>
                  {primeEarnings && primeEarnings.length > 0 ? (
                    <div className="mt-2 h-16 bg-black/20 rounded-lg border border-white/5 p-1">
                      <ResponsiveContainer width="100%" height="100%">
                        <BarChart data={primeEarnings}>
                          <XAxis dataKey="date" hide />
                          <Bar dataKey="total" fill="var(--accent)" radius={[4,4,0,0]} />
                        </BarChart>
                      </ResponsiveContainer>
                    </div>
                  ) : (
                    <div className="mt-2 h-16 bg-black/20 rounded-lg border border-white/5 grid place-items-center text-[11px] text-white/25">No earnings last 7d</div>
                  )}
                  <p className="text-[11px] text-white/25 mt-2 text-center">{me.storageUsed?.toFixed(0)}/{me.storageLimit} MB • {me.ghostCoins||0} coins • {me.tierDaysLeft ?? 0}d left</p>
                </div>
              )}
              {me.tier === "PLUS" && (
                <div className="card p-3 mb-3 border-primary/20 bg-primary/[0.06]">
                  <p className="text-[10px] font-bold tracking-widest text-primary/70 uppercase mb-1">Plus</p>
                  <p className="text-xs text-white/60 mb-2">You have edits & priority. Prime unlocks earnings & full avatars.</p>
                  <button className="btn-primary w-full text-xs" onClick={() => { setShowDrawer(false); router.push("/upgrade") }}>Go Prime — GHS 20</button>
                  <p className="text-[11px] text-white/25 mt-1.5 text-center">{me.tierDaysLeft!=null?`${me.tierDaysLeft}d left`:''} • {me.storageUsed?.toFixed(0)}/{me.storageLimit} MB</p>
                </div>
              )}
              {me.tier === "FREE" && (
                <div className="card p-3 mb-3 border-primary/20 bg-primary/[0.06]">
                  <p className="text-[10px] font-bold tracking-widest text-primary/70 uppercase mb-2">Go Prime</p>
                  <p className="text-xs text-white/60 mb-2">Earnings, full avatars, payouts</p>
                  <button className="btn-primary w-full text-xs" onClick={() => { setShowDrawer(false); router.push("/upgrade") }}>Upgrade — GHS 20</button>
                  <p className="text-[11px] text-white/25 mt-1.5 text-center">or get Plus — GHS 10/mo</p>
                </div>
              )}
              {/* Free: nothing else — just nav below */}

              <div className="space-y-1">
                <button className="w-full text-left py-2.5 px-3 rounded-xl hover:bg-white/5 text-sm flex items-center gap-2" onClick={() => { setShowDrawer(false); router.push("/lair") }}>👻 My Lair <span className="ml-auto text-white/20">›</span></button>
                <button className="w-full text-left py-2.5 px-3 rounded-xl hover:bg-white/5 text-sm flex items-center gap-2" onClick={() => { setShowDrawer(false); router.push("/shop") }}>🛍️ Shop <span className="ml-auto text-white/20">›</span></button>
                <button className="w-full text-left py-2.5 px-3 rounded-xl hover:bg-white/5 text-sm flex items-center gap-2" onClick={() => { setShowDrawer(false); router.push("/leaderboard") }}>🏆 Leaderboard <span className="ml-auto text-white/20">›</span></button>
                <button className="w-full text-left py-2.5 px-3 rounded-xl hover:bg-white/5 text-sm flex items-center gap-2" onClick={() => { setShowDrawer(false); setShowNameModal(true) }}>✏️ Edit ghost name</button>
                <button className="w-full text-left py-2.5 px-3 rounded-xl hover:bg-white/5 text-sm flex items-center gap-2" onClick={openAvatarModal}>🎭 Edit avatar</button>
              </div>
            </div>
            <div className="p-4 border-t border-white/10">
              <button className="btn-ghost w-full" onClick={handleLogout}>Log out</button>
            </div>
          </div>
          <div className="flex-1 bg-black/60" onClick={() => setShowDrawer(false)} />
        </div>
      )}

      {showAvatarModal && (
        <div className="fixed inset-0 bg-black/70 flex items-center justify-center z-50 px-4">
          <div className="card p-5 w-full max-w-sm bg-black">
            <h3 className="font-bold text-lg mb-1">Pick your avatar</h3>
            <p className="text-white/50 text-sm mb-4">Unlocked by tier or purchased in the Shop.</p>
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
              Cancel
            </button>
          </div>
        </div>
      )}

      {showNameModal && (
        <div className="fixed inset-0 bg-black/70 flex items-center justify-center z-50 px-4">
          <div className="card p-5 w-full max-w-sm bg-black">
            <h3 className="font-bold text-lg mb-1">Change your ghost name</h3>
            <p className="text-white/50 text-sm mb-4">Costs GHS 3.00 via Paystack.</p>
            <input className="input mb-3" placeholder="New ghost name" value={newName} onChange={(e) => setNewName(e.target.value)} />
            <div className="flex gap-2">
              <button className="btn-ghost flex-1" onClick={() => setShowNameModal(false)}>Cancel</button>
              <button className="btn-primary flex-1" onClick={handleNameChange}>Pay & Change</button>
            </div>
          </div>
        </div>
      )}
    </main>
  )
}