"use client"

import { useEffect, useState } from "react"
import { useRouter } from "next/navigation"
import { apiGet, apiPost, apiDelete, apiPatch } from "@/lib/useApi"
import { timeAgo } from "@/lib/timeAgo"
import { blockIfNative } from "@/lib/purchaseGate"

type Post = {
  id: string
  text: string | null
  imageUrl: string | null
  type: string
  yeahs: number
  commentsCount: number
  boosted: boolean
  createdAt: string
  user: { id: string; ghostId: string; avatarEmoji: string; tier: string }
}

type Me = {
  id: string
  ghostId: string
  avatarEmoji: string
  campus: string
  tier: string
  streakCount: number
  followersCount: number
  followingCount: number
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

  async function loadMe() {
    try {
      const data = await apiGet("/api/auth/me")
      setMe(data.user)
    } catch {
      router.push("/login")
    }
  }

  async function loadFeed() {
    setLoading(true)
    try {
      const data = await apiGet(`/api/posts?mode=${mode}`)
      setPosts(data.posts)
      setNextCursor(data.nextCursor)
    } catch (err: any) {
      if (err.message === "Not authenticated.") {
        router.push("/login")
        return
      }
      console.error(err)
    } finally {
      setLoading(false)
    }
  }

  async function loadMore() {
    if (!nextCursor || loadingMore) return
    setLoadingMore(true)
    try {
      const data = await apiGet(`/api/posts?mode=${mode}&cursor=${nextCursor}`)
      setPosts((prev) => [...prev, ...data.posts])
      setNextCursor(data.nextCursor)
    } catch (err) {
      console.error(err)
    } finally {
      setLoadingMore(false)
    }
  }

  useEffect(() => {
    loadMe()
  }, [])

  useEffect(() => {
    loadFeed()
  }, [mode])

  useEffect(() => {
    function handleScroll() {
      if (window.innerHeight + window.scrollY >= document.body.offsetHeight - 300) {
        loadMore()
      }
    }
    window.addEventListener("scroll", handleScroll)
    return () => window.removeEventListener("scroll", handleScroll)
  }, [nextCursor, loadingMore, mode])

  async function handleVote(postId: string) {
    try {
      await apiPost(`/api/posts/${postId}/vote`, {})
      setPosts((prev) => prev.map((p) => (p.id === postId ? { ...p, yeahs: p.yeahs + 1 } : p)))
    } catch (err: any) {
      alert(err.message)
    }
  }

  async function handleBoost(postId: string) {
    if (blockIfNative()) return
    try {
      await apiPost(`/api/boost/${postId}`, {})
      alert("Boosted for 24h!")
      loadFeed()
    } catch (err: any) {
      if (err.message.includes("Buy")) {
        if (confirm("No boost credits left. Go buy some in the Shop?")) router.push("/shop")
      } else {
        alert(err.message)
      }
    }
  }

  async function handleFollow(targetUserId: string) {
    try {
      const data = await apiPost("/api/follow", { targetUserId })
      alert(data.following ? "Followed." : "Unfollowed.")
      loadMe()
    } catch (err: any) {
      alert(err.message)
    }
  }

  async function handleReport(postId: string) {
    const reason = prompt("Why are you reporting this post?")
    if (!reason?.trim()) return
    try {
      await apiPost("/api/reports", { postId, reason })
      alert("Reported — this post is now hidden pending review.")
      loadFeed()
    } catch (err: any) {
      alert(err.message)
    }
  }

  async function handleDelete(postId: string) {
    if (!confirm("Delete this post?")) return
    try {
      await apiDelete(`/api/posts/${postId}`)
      setPosts((prev) => prev.filter((p) => p.id !== postId))
    } catch (err: any) {
      alert(err.message)
    }
  }

  async function handleEdit(postId: string, currentText: string | null) {
    const newText = prompt("Edit your post:", currentText || "")
    if (newText === null || !newText.trim()) return
    try {
      await apiPatch(`/api/posts/${postId}`, { text: newText })
      setPosts((prev) => prev.map((p) => (p.id === postId ? { ...p, text: newText } : p)))
    } catch (err: any) {
      alert(err.message)
    }
  }

  async function handleNameChange() {
    if (!newName.trim()) return
    if (blockIfNative()) return
    try {
      const data = await apiPost("/api/shop/custom-name", { newName })
      if (data.data?.authorization_url) window.location.href = data.data.authorization_url
    } catch (err: any) {
      alert(err.message)
    }
  }

  async function openAvatarModal() {
    try {
      const data = await apiGet("/api/profile/avatar")
      setAvailableAvatars(data.available)
      setShowDrawer(false)
      setShowAvatarModal(true)
    } catch (err: any) {
      alert(err.message)
    }
  }

  async function handlePickAvatar(emoji: string) {
    try {
      await apiPost("/api/profile/avatar", { emoji })
      setShowAvatarModal(false)
      loadMe()
    } catch (err: any) {
      alert(err.message)
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
      </div>

      <div className="sticky top-0 bg-black/90 backdrop-blur border-b border-white/10 px-2 grid grid-cols-4 z-10">
        {TABS.map((tab) => (
          <button
            key={tab.key}
            onClick={() => setMode(tab.key)}
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
            return (
              <div key={post.id} className="px-4 py-3 border-b border-white/[0.06]">
                <div className="flex items-start gap-3">
                  <div className="avatar-circle text-base flex-shrink-0">{post.user.avatarEmoji}</div>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 flex-wrap text-sm">
                      <span className="font-semibold">{post.user.ghostId}</span>
                      {post.user.tier === "PRIME" && <span className="badge badge-prime">Prime</span>}
                      {post.boosted && <span className="badge badge-boosted">Boosted</span>}
                      <span className="text-white/30">· {timeAgo(post.createdAt)}</span>
                    </div>

                    {post.text && <p className="text-white/90 mt-1 whitespace-pre-wrap leading-snug">{post.text}</p>}
                    {post.imageUrl && (
                      <img src={post.imageUrl} className="rounded-xl mt-2 w-full max-h-96 object-cover" alt="" />
                    )}

                    <div className="flex gap-4 text-sm text-white/40 pt-2">
                                        {isOwn ? (
                        <span className="flex items-center gap-1 text-white/30">🔥 {post.yeahs}</span>
                      ) : (
                        <button onClick={() => handleVote(post.id)} className="hover:text-[#baff39] flex items-center gap-1">
                          🔥 {post.yeahs}
                        </button>
                      )}
                      <button
                        onClick={() => router.push(`/post/${post.id}`)}
                        className="hover:text-[#baff39] flex items-center gap-1"
                      >
                        💬 {post.commentsCount}
                      </button>
                      {isOwn && (
                        <button onClick={() => handleBoost(post.id)} className="hover:text-[#baff39]">
                          🚀
                        </button>
                      )}
                      {!isOwn && (
                        <button onClick={() => handleFollow(post.user.id)} className="hover:text-[#baff39]">
                          ➕
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
          <div className="w-72 bg-black border-r border-white/10 p-5 flex flex-col overflow-y-auto">
            <div className="avatar-circle text-xl w-14 h-14 mb-3">{me.avatarEmoji}</div>
            <p className="font-bold">{me.ghostId}</p>
            <p className="text-xs text-white/40 mb-4">{me.campus}</p>

            <div className="flex gap-4 mb-5 text-sm">
              <div>
                <span className="font-bold">{me.followingCount}</span> <span className="text-white/40">Following</span>
              </div>
              <div>
                <span className="font-bold">{me.followersCount}</span> <span className="text-white/40">Followers</span>
              </div>
            </div>

            <button className="text-left py-2 text-sm" onClick={() => { setShowDrawer(false); router.push("/lair") }}>
              👻 My Lair
            </button>
            <button className="text-left py-2 text-sm" onClick={() => { setShowDrawer(false); setShowNameModal(true) }}>
              ✏️ Edit ghost name
            </button>
            <button className="text-left py-2 text-sm" onClick={openAvatarModal}>
              🎭 Edit avatar
            </button>

            <div className="mt-auto pt-4">
              <button className="btn-ghost w-full" onClick={handleLogout}>
                Log out
              </button>
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