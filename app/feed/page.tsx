"use client"

import { useCallback, useEffect, useRef, useState } from "react"
import { useRouter } from "next/navigation"
import Link from "next/link"
import Image from "next/image"
import { apiGet, apiPost, apiDelete, apiPatch } from "@/lib/useApi"
import { timeAgo } from "@/lib/timeAgo"
import { openPaystackCheckout } from "@/lib/purchaseGate"
import RichText from "@/app/components/RichText"
import { useSocket } from "@/lib/socket"

type Post = {
  id: string
  text: string | null
  imageUrl: string | null
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
  { key: "campus", label: "For You" },
  { key: "following", label: "Following" },
  { key: "all", label: "All" },
  { key: "program", label: "Class" },
]

const EMPTY_MESSAGES: Record<string, string> = {
  campus: "Quiet on campus right now. Be the first ghost to say something today.",
  following: "You're not following anyone yet — follow a few ghosts from the feed to see their posts here.",
  all: "Nothing from other campuses yet. Check back soon.",
  program: "No posts from your program yet — start the conversation.",
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
    <main className="min-h-screen max-w-lg mx-auto pb-28 relative">
      <div className="relative flex items-center justify-center px-4 py-3">
        <button onClick={() => setShowDrawer(true)} className="absolute left-4">
          <div className="avatar-circle">{me?.avatarEmoji || "👻"}</div>
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
            className={`text-sm py-3 text-center ${mode === tab.key ? "tab-active" : "tab-inactive"}`}
          >
            {tab.label}
          </button>
        ))}
      </div>

      {loading ? (
        <p className="text-center text-white/40 mt-10">Loading feed...</p>
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
            return (
              <div key={post.id} className="relative px-4 py-3 border-b border-white/[0.06] hover:bg-white/[0.02]">
                <Link href={`/post/${post.id}`} aria-label={`Open post by ${post.user.ghostId}`} className="absolute inset-0 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-[#baff39]" />
                <div className="flex items-start gap-3">
                  <Link
                    href={`/u/${encodeURIComponent(post.user.ghostId)}`}
                    aria-label={`View ${post.user.ghostId}'s profile`}
                    className="relative z-10 flex-shrink-0 focus-visible:outline-[#baff39]"
                  >
                    <div className="avatar-circle text-base">{post.user.avatarEmoji}</div>
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
                      {post.user.tier === "PRIME" && <span className="badge badge-prime">Prime</span>}
                      {post.boosted && <span className="badge badge-boosted">Boosted</span>}
                      <span className="text-white/30">· {timeAgo(post.createdAt)}</span>
                    </div>

                    {post.text && (
                      <p className="text-white/90 mt-1 whitespace-pre-wrap leading-snug">
                        <RichText text={post.text} />
                      </p>
                    )}
                    {post.imageUrl && (
                      <div className="relative w-full h-64 mt-2 rounded-xl overflow-hidden bg-white/5 border border-white/10">
                        <Image
                          src={post.imageUrl}
                          alt=""
                          fill
                          className="object-cover"
                          sizes="(max-width: 768px) 100vw, 50vw"
                          unoptimized
                        />
                      </div>
                    )}

                    <div className="flex flex-wrap items-center gap-x-5 gap-y-2 text-sm text-white/70 pt-2 [&_button]:relative [&_button]:z-10 [&_button]:inline-flex [&_button]:items-center [&_button]:shrink-0 [&_button]:focus-visible:outline-[#baff39]">
                      {isOwn ? (
                        <span className="inline-flex items-center gap-1 text-orange-200">🔥 {post.yeahs}</span>
                      ) : (
                        <button onClick={() => handleVote(post.id)} aria-label={`Add heat, ${post.yeahs} heat`} className="text-orange-200 hover:text-orange-100 gap-1">
                          🔥 {post.yeahs}
                        </button>
                      )}
                      <button
                        onClick={() => router.push(`/post/${post.id}`)}
                        aria-label={`View comments, ${post.commentsCount} comments`}
                        className="text-sky-200 hover:text-sky-100 gap-1"
                      >
                        💬 {post.commentsCount}
                      </button>
                      {isOwn && (
                        <button onClick={() => handleBoost(post.id)} className="hover:text-[#baff39]">
                          🚀
                        </button>
                      )}
                      {!isOwn && (
                        <button
                          onClick={() => handleFollow(post.user.id)}
                          disabled={!me || followPending}
                          aria-label={`${isFollowing ? "Unfollow" : "Follow"} ${post.user.ghostId}`}
                          aria-pressed={isFollowing}
                          aria-busy={followPending}
                          title={isFollowing ? "Following" : "Follow"}
                          className={`${isFollowing ? "text-[#baff39]" : "text-white/90"} hover:text-[#baff39] disabled:opacity-50 disabled:cursor-wait`}
                        >
                          <svg aria-hidden="true" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                            <path d={isFollowing ? "M5 12l4 4L19 6" : "M12 5v14M5 12h14"} />
                          </svg>
                        </button>
                      )}
                      {isOwn && me && me.tier !== "FREE" && (
                        <button onClick={() => handleEdit(post.id, post.text)} className="hover:text-[#baff39]">
                          ✎
                        </button>
                      )}
                      {isOwn && (
                        <button onClick={() => handleDelete(post.id)} className="hover:text-red-400">
                          🗑
                        </button>
                      )}
                      {!isOwn && (
                        <button onClick={() => handleReport(post.id)} className="hover:text-white/70 ml-auto text-xs">
                          ⚑
                        </button>
                      )}
                    </div>
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
                <div className="avatar-circle text-xl w-14 h-14">{me.avatarEmoji}</div>
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

              {/* Prime — useful filled card */}
              {me.tier === "PRIME" && (
                <div className="card p-3 mb-3 border-[#facc15]/20 bg-[#facc15]/[0.06]">
                  <p className="text-[10px] font-bold tracking-widest text-[#facc15]/70 uppercase mb-2">Prime • useful</p>
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
                  <div className="flex gap-2 mt-2">
                    <button className="btn-primary flex-1 text-xs py-1.5" onClick={() => { setShowDrawer(false); router.push("/lair") }}>Lair → payout</button>
                    <button className="btn-ghost flex-1 text-xs py-1.5" onClick={() => { setShowDrawer(false); router.push("/upgrade") }}>Manage</button>
                  </div>
                  <p className="text-[11px] text-white/25 mt-2 text-center">{me.storageUsed?.toFixed(0)} / {me.storageLimit} MB • {me.ghostCoins||0} coins</p>
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
              {me.tier === "FREE" && (
                <div className="card p-3 mb-3 bg-white/[0.03] border-white/10">
                  <p className="text-[10px] font-bold tracking-widest text-white/30 uppercase mb-1">Upgrade</p>
                  <p className="text-xs text-white/50 mb-2">Get Plus (GHS 10) or Prime (GHS 20) for more.</p>
                  <div className="flex gap-2">
                    <button className="btn-ghost flex-1 text-xs" onClick={() => { setShowDrawer(false); router.push("/shop") }}>Shop</button>
                    <button className="btn-primary flex-1 text-xs" onClick={() => { setShowDrawer(false); router.push("/upgrade") }}>Upgrade</button>
                  </div>
                </div>
              )}

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
                  className="avatar-circle text-2xl w-14 h-14 mx-auto hover:bg-[#baff39]/20"
                >
                  {emoji}
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