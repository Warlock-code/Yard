"use client"

import { useCallback, useEffect, useRef, useState } from "react"
import { useRouter } from "next/navigation"
import Link from "next/link"
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
  repostsCount: number
  bookmarksCount: number
  boosted: boolean
  isFollowing: boolean
  isReposted: boolean
  isBookmarked: boolean
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
  const [followingByAuthor, setFollowingByAuthor] = useState<Record<string, boolean>>({})
  const [pendingFollows, setPendingFollows] = useState<Set<string>>(new Set())
  const pendingFollowRequests = useRef(new Set<string>())
  const [primeEarnings, setPrimeEarnings] = useState<{ date: string; total: number }[] | null>(null)
  const [expandedPosts, setExpandedPosts] = useState<Set<string>>(new Set())
  const [pullToRefresh, setPullToRefresh] = useState(false)
  const pullStartRef = useRef<number | null>(null)

  const { connected, on, joinCampus, leaveCampus } = useSocket()

  const loadMe = useCallback((isCurrent: () => boolean = () => true) => {
    return apiGet("/api/auth/me")
      .then((data) => {
        if (isCurrent()) setMe(data.user)
      })
      .catch(() => {
        if (isCurrent()) router.push("/login")
      })
  }, [router])

  function loadFeed() {
    setLoading(true)
    setLoadingMore(false)
    setFeedVersion((version) => version + 1)
  }

  function selectMode(nextMode: string) {
    if (nextMode === mode) return
    setLoading(true)
    setLoadingMore(false)
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
    apiGet(`/api/posts?mode=${mode}`)
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
  }, [mode, feedVersion, router])

  useEffect(() => {
    if (loading || !nextCursor) return
    let active = true
    let pending = false

    async function loadMore() {
      if (pending) return
      pending = true
      setLoadingMore(true)
      try {
        const data = await apiGet(`/api/posts?mode=${mode}&cursor=${nextCursor}`)
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
  }, [nextCursor, loading, mode, feedVersion])

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
    return () => {
      unsubNewPost()
      unsubVote()
    }
  }, [connected, on, mode, me?.campus])

  async function handleVote(postId: string) {
    try {
      await apiPost(`/api/posts/${postId}/vote`, {})
    } catch (err: unknown) {
      alert(err instanceof Error ? err.message : "Something went wrong.")
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

  async function handleRepost(postId: string) {
    try {
      await apiPost(`/api/posts/${postId}/repost`, {})
      setPosts((prev) => prev.map((p) => p.id === postId ? { ...p, isReposted: true, repostsCount: p.repostsCount + 1 } : p))
    } catch (err: unknown) {
      alert(err instanceof Error ? err.message : "Something went wrong.")
    }
  }

  async function handleBookmark(postId: string) {
    try {
      await apiPost(`/api/posts/${postId}/bookmark`, {})
      setPosts((prev) => prev.map((p) => p.id === postId ? { ...p, isBookmarked: !p.isBookmarked, bookmarksCount: p.isBookmarked ? p.bookmarksCount - 1 : p.bookmarksCount + 1 } : p))
    } catch (err: unknown) {
      alert(err instanceof Error ? err.message : "Something went wrong.")
    }
  }

  async function handleShare(postId: string) {
    const url = `${window.location.origin}/post/${postId}`
    if (navigator.share) {
      try {
        await navigator.share({ title: "Yard Post", url })
      } catch {}
    } else {
      await navigator.clipboard.writeText(url)
      alert("Link copied!")
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

  function toggleExpand(postId: string) {
    setExpandedPosts((prev) => {
      const next = new Set(prev)
      if (next.has(postId)) next.delete(postId)
      else next.add(postId)
      return next
    })
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
        <button onClick={() => setShowDrawer(true)} className="absolute left-4">
          <Avatar emoji={me?.avatarEmoji || "👻"} size={32} />
        </button>
        <span className="font-black text-lg tracking-tight">
          YARD<span className="text-[#baff39]">.</span>
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
          <div className="bg-black/80 backdrop-blur border border-white/10 rounded-full px-4 py-2 text-sm text-[#baff39] font-medium animate-pulse">
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
            const isExpanded = expandedPosts.has(post.id)
            const images = post.imageUrls && post.imageUrls.length > 0 ? post.imageUrls : (post.imageUrl ? [post.imageUrl] : [])
            const showMore = post.text && post.text.split('\n').length > 3

            return (
              <div key={post.id} className="relative px-4 py-3 border-b border-white/[0.06] hover:bg-white/[0.02]">
                <Link href={`/post/${post.id}`} aria-label={`Open post by ${post.user.ghostId}`} className="absolute inset-0 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-[#baff39]" />
                <div className="flex items-start gap-3">
                  <Link
                    href={`/u/${encodeURIComponent(post.user.ghostId)}`}
                    aria-label={`View ${post.user.ghostId}'s profile`}
                    className="relative z-10 flex-shrink-0 focus-visible:outline-[#baff39]"
                  >
                    <Avatar emoji={post.user.avatarEmoji} size={40} />
                  </Link>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 flex-wrap text-sm">
                      <Link
                        href={`/u/${encodeURIComponent(post.user.ghostId)}`}
                        aria-label={`View ${post.user.ghostId}'s profile`}
                        className="font-semibold relative z-10 focus-visible:outline-[#baff39]"
                      >
                        {post.user.ghostId}
                      </Link>
                      {post.user.tier === "PRIME" && <span className="badge badge-prime">✓ Prime</span>}
                      {post.boosted && <span className="badge badge-boosted">Boosted</span>}
                      <span className="text-white/30">· {timeAgo(post.createdAt)}</span>
                    </div>

                    {post.text && (
                      <p className="text-white/90 mt-1 whitespace-pre-wrap leading-relaxed text-base" style={{ lineHeight: 1.5 }}>
                        {isExpanded || !showMore ? (
                          <RichText text={post.text} />
                        ) : (
                          <>
                            <RichText text={post.text.split('\n').slice(0, 3).join('\n')} />
                            <button
                              onClick={(e) => { e.preventDefault(); e.stopPropagation(); toggleExpand(post.id) }}
                              className="text-[#baff39] text-sm mt-1 hover:underline focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-[#baff39]"
                            >
                              Show more
                            </button>
                          </>
                        )}
                      </p>
                    )}

                    {images.length > 0 && (
                      <div className="mt-2 grid gap-1" style={{
                        gridTemplateColumns: images.length === 1 ? '1fr' : images.length === 2 ? '1fr 1fr' : images.length === 3 ? '1fr 1fr' : '1fr 1fr',
                        gridTemplateRows: images.length === 3 ? '1fr 1fr' : images.length === 4 ? '1fr 1fr' : 'auto'
                      }}>
                        {images.map((img, idx) => (
                          <div
                            key={idx}
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

                    <div className="flex items-center justify-between px-1 py-2 text-sm text-white/60 border-t border-white/[0.04]">
                      <button
                        onClick={() => router.push(`/post/${post.id}`)}
                        aria-label={`Reply, ${post.commentsCount} replies`}
                        className="flex items-center gap-1.5 px-3 py-2 rounded-full hover:bg-white/5 transition-colors"
                      >
                        <span aria-hidden="true">💬</span>
                        <span>{post.commentsCount}</span>
                      </button>
                      <button
                        onClick={() => handleRepost(post.id)}
                        aria-label={`Repost, ${post.repostsCount} reposts`}
                        className={`flex items-center gap-1.5 px-3 py-2 rounded-full hover:bg-white/5 transition-colors ${post.isReposted ? 'text-[#baff39]' : ''}`}
                      >
                        <span aria-hidden="true">🔁</span>
                        <span>{post.repostsCount}</span>
                      </button>
                      <button
                        onClick={() => handleVote(post.id)}
                        aria-label={`Like, ${post.yeahs} likes`}
                        className={`flex items-center gap-1.5 px-3 py-2 rounded-full hover:bg-white/5 transition-colors ${isOwn ? 'text-orange-200' : ''}`}
                      >
                        <span aria-hidden="true">🔥</span>
                        <span>{post.yeahs}</span>
                      </button>
                      <button
                        onClick={() => handleShare(post.id)}
                        aria-label="Share"
                        className="flex items-center gap-1.5 px-3 py-2 rounded-full hover:bg-white/5 transition-colors"
                      >
                        <span aria-hidden="true">📤</span>
                      </button>
                      <button
                        onClick={() => handleBookmark(post.id)}
                        aria-label={`Bookmark, ${post.bookmarksCount} bookmarks`}
                        className={`flex items-center gap-1.5 px-3 py-2 rounded-full hover:bg-white/5 transition-colors ${post.isBookmarked ? 'text-[#baff39]' : ''}`}
                      >
                        <span aria-hidden="true">🔖</span>
                        <span>{post.bookmarksCount}</span>
                      </button>
                    </div>

                    {!isOwn && (
                      <div className="flex items-center gap-2 pt-1">
                        <button
                          onClick={() => handleFollow(post.user.id)}
                          disabled={!me || followPending}
                          aria-label={`${isFollowing ? "Unfollow" : "Follow"} ${post.user.ghostId}`}
                          aria-pressed={isFollowing}
                          aria-busy={followPending}
                          title={isFollowing ? "Following" : "Follow"}
                          className={`flex items-center gap-1 px-3 py-1.5 rounded-full text-xs font-medium transition-colors ${isFollowing ? "bg-[#baff39]/15 text-[#baff39] border border-[#baff39]/30" : "bg-white/5 text-white/70 hover:bg-white/10 hover:text-[#baff39] border border-white/10"} disabled:opacity-50 disabled:cursor-wait`}
                        >
                          <svg aria-hidden="true" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                            <path d={isFollowing ? "M5 12l4 4L19 6" : "M12 5v14M5 12h14"} />
                          </svg>
                          {isFollowing ? "Following" : "Follow"}
                        </button>
                        {isOwn && me && me.tier !== "FREE" && (
                          <button onClick={() => handleEdit(post.id, post.text)} className="hover:text-[#baff39] text-white/50 text-sm px-2">
                            ✎ Edit
                          </button>
                        )}
                        {isOwn && (
                          <button onClick={() => handleDelete(post.id)} className="hover:text-red-400 text-white/50 text-sm px-2">
                            🗑 Delete
                          </button>
                        )}
                        {!isOwn && (
                          <button onClick={() => handleReport(post.id)} className="hover:text-white/70 ml-auto text-xs text-white/40 px-2">
                            ⚑ Report
                          </button>
                        )}
                      </div>
                    )}
                  </div>
                </div>
              </div>
            )
          })}
          {loadingMore && <p className="text-center text-white/30 text-sm py-4">Loading more...</p>}
        </div>
      )}

      <button
        onClick={() => router.push("/compose")}
        className="fixed bottom-24 right-5 w-14 h-14 rounded-full bg-[#baff39] text-black text-2xl flex items-center justify-center shadow-[0_8px_24px_rgba(186,255,57,0.35)] z-20"
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
                <div className="card p-3 mb-3 border-[#facc15]/20 bg-[#facc15]/[0.06]">
                  <p className="text-[10px] font-bold tracking-widest text-[#facc15]/70 uppercase mb-2">Prime • earnings</p>
                  <div className="grid grid-cols-2 gap-2">
                    <div className="bg-black/30 rounded-lg p-2 border border-white/5">
                      <p className="text-[10px] text-white/30">Earned</p>
                      <p className="text-sm font-black text-white">GHS {((me.totalEarnedPesewas||0)/100).toFixed(2)}</p>
                    </div>
                    <div className="bg-black/30 rounded-lg p-2 border border-white/5">
                      <p className="text-[10px] text-white/30">Balance</p>
                      <p className="text-sm font-black text-[#baff39]">GHS {((me.availableBalancePesewas||0)/100).toFixed(2)}</p>
                      {me.hasPendingPayout && <p className="text-[10px] text-amber-400">⏳ pending</p>}
                    </div>
                  </div>
                  {primeEarnings && primeEarnings.length > 0 ? (
                    <div className="mt-2 h-16 bg-black/20 rounded-lg border border-white/5 p-1">
                      <ResponsiveContainer width="100%" height="100%">
                        <BarChart data={primeEarnings}>
                          <XAxis dataKey="date" hide />
                          <Bar dataKey="total" fill="#facc15" radius={[4,4,0,0]} />
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
                <div className="card p-3 mb-3 border-sky-500/20 bg-sky-500/[0.06]">
                  <p className="text-[10px] font-bold tracking-widest text-sky-300/70 uppercase mb-1">Plus</p>
                  <p className="text-xs text-white/60 mb-2">You have edits & priority. Prime unlocks earnings & full avatars.</p>
                  <button className="btn-primary w-full text-xs" onClick={() => { setShowDrawer(false); router.push("/upgrade") }}>Go Prime — GHS 20</button>
                  <p className="text-[11px] text-white/25 mt-1.5 text-center">{me.tierDaysLeft!=null?`${me.tierDaysLeft}d left`:''} • {me.storageUsed?.toFixed(0)}/{me.storageLimit} MB</p>
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
                  className="relative w-14 h-14 mx-auto hover:bg-[#baff39]/20"
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