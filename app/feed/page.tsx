"use client"

import { useEffect, useState } from "react"
import { useRouter } from "next/navigation"
import { apiGet, apiPost } from "@/lib/useApi"
import { timeAgo } from "@/lib/timeAgo"
import { useUploadThing } from "@/lib/uploadthing"

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
  { key: "program", label: "For You" },
  { key: "following", label: "Following" },
  { key: "campus", label: "All" },
]

export default function FeedPage() {
  const router = useRouter()
  const [me, setMe] = useState<Me | null>(null)
  const [posts, setPosts] = useState<Post[]>([])
  const [mode, setMode] = useState("program")
  const [loading, setLoading] = useState(true)
  const [composeText, setComposeText] = useState("")
  const [composeImage, setComposeImage] = useState<string | null>(null)
  const [posting, setPosting] = useState(false)
  const [showNameModal, setShowNameModal] = useState(false)
  const [newName, setNewName] = useState("")
  const [showDrawer, setShowDrawer] = useState(false)

  const { startUpload, isUploading } = useUploadThing("postImage", {
    onClientUploadComplete: (res) => {
      if (res?.[0]?.url) setComposeImage(res[0].url)
    },
    onUploadError: (err) => alert(`Upload failed: ${err.message}`),
  })

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

  useEffect(() => {
    loadMe()
  }, [])

  useEffect(() => {
    loadFeed()
  }, [mode])

  async function handlePost() {
    if (!composeText.trim() && !composeImage) return
    setPosting(true)
    try {
      await apiPost("/api/posts", { text: composeText, imageUrl: composeImage, type: "confession" })
      setComposeText("")
      setComposeImage(null)
      loadFeed()
      loadMe()
    } catch (err: any) {
      alert(err.message)
    } finally {
      setPosting(false)
    }
  }

  async function handleVote(postId: string) {
    try {
      await apiPost(`/api/posts/${postId}/vote`, {})
      setPosts((prev) => prev.map((p) => (p.id === postId ? { ...p, yeahs: p.yeahs + 1 } : p)))
    } catch (err: any) {
      alert(err.message)
    }
  }

  async function handleBoost(postId: string) {
    try {
      const data = await apiPost(`/api/boost/${postId}`, {})
      if (data.data?.authorization_url) window.location.href = data.data.authorization_url
    } catch (err: any) {
      alert(err.message)
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

  async function handleNameChange() {
    if (!newName.trim()) return
    try {
      const data = await apiPost("/api/shop/custom-name", { newName })
      if (data.data?.authorization_url) window.location.href = data.data.authorization_url
    } catch (err: any) {
      alert(err.message)
    }
  }

  async function handleLogout() {
    document.cookie = "yard_token=; Max-Age=0; path=/"
    router.push("/login")
  }

  function handleImagePick(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0]
    if (file) startUpload([file])
  }

  return (
    <main className="min-h-screen max-w-lg mx-auto pb-24">
      {/* X-style minimal top bar */}
      <div className="flex items-center px-4 py-3">
        <button onClick={() => setShowDrawer(true)}>
          <div className="avatar-circle">{me?.avatarEmoji || "👻"}</div>
        </button>
      </div>

      {/* Tabs */}
      <div className="sticky top-0 bg-black/90 backdrop-blur border-b border-white/10 px-4 flex gap-6 z-10">
        {TABS.map((tab) => (
          <button
            key={tab.key}
            onClick={() => setMode(tab.key)}
            className={`text-sm py-3 ${mode === tab.key ? "tab-active" : "tab-inactive"}`}
          >
            {tab.label}
          </button>
        ))}
      </div>

      {/* Compose box */}
      <div className="card mx-4 mt-4 p-4">
        <textarea
          className="input resize-none"
          placeholder="What's the gist?"
          rows={3}
          value={composeText}
          onChange={(e) => setComposeText(e.target.value)}
        />

        {composeImage && (
          <div className="relative mt-3">
            <img src={composeImage} className="rounded-lg w-full max-h-64 object-cover" alt="" />
            <button
              onClick={() => setComposeImage(null)}
              className="absolute top-2 right-2 bg-black/70 rounded-full w-7 h-7 text-sm"
            >
              ✕
            </button>
          </div>
        )}

        <div className="flex items-center justify-between mt-3">
          <label className="btn-ghost cursor-pointer">
            {isUploading ? "Uploading..." : "📷 Add photo"}
            <input type="file" accept="image/*" className="hidden" onChange={handleImagePick} />
          </label>
          <button
            className="btn-primary px-6"
            onClick={handlePost}
            disabled={posting || isUploading || (!composeText.trim() && !composeImage)}
          >
            {posting ? "Posting..." : "Post"}
          </button>
        </div>
      </div>

      {/* Feed */}
      {loading ? (
        <p className="text-center text-white/40 mt-10">Loading feed...</p>
      ) : posts.length === 0 ? (
        <p className="text-center text-white/40 mt-10">No posts yet — be the first ghost to post.</p>
      ) : (
        <div className="space-y-3 px-4 mt-4">
          {posts.map((post) => (
            <div key={post.id} className="card p-4">
              <div className="flex items-center gap-3 mb-3">
                <div className="avatar-circle text-base">{post.user.avatarEmoji}</div>
                <div className="flex-1">
                  <div className="flex items-center gap-2 flex-wrap">
                    <span className="font-semibold text-sm">{post.user.ghostId}</span>
                    {post.user.tier === "PRIME" && <span className="badge badge-prime">Prime</span>}
                    {post.boosted && <span className="badge badge-boosted">Boosted</span>}
                  </div>
                  <span className="text-xs text-white/40">{timeAgo(post.createdAt)}</span>
                </div>
              </div>

              {post.text && <p className="text-white/90 mb-3 whitespace-pre-wrap leading-relaxed">{post.text}</p>}
              {post.imageUrl && (
                <img src={post.imageUrl} className="rounded-lg mb-3 w-full max-h-96 object-cover" alt="" />
              )}

              <div className="flex gap-5 text-sm text-white/50 pt-1">
                <button onClick={() => handleVote(post.id)} className="hover:text-white flex items-center gap-1">
                  🔥 {post.yeahs}
                </button>
                <button
                  onClick={() => router.push(`/post/${post.id}`)}
                  className="hover:text-white flex items-center gap-1"
                >
                  💬 {post.commentsCount}
                </button>
                <button onClick={() => handleBoost(post.id)} className="hover:text-white flex items-center gap-1">
                  🚀
                </button>
                <button onClick={() => handleFollow(post.user.id)} className="hover:text-white flex items-center gap-1">
                  ➕
                </button>
                <button onClick={() => handleReport(post.id)} className="hover:text-white/70 ml-auto text-xs">
                  ⚑ Report
                </button>
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Side drawer — X style */}
      {showDrawer && me && (
        <div className="fixed inset-0 z-50 flex">
          <div className="w-72 bg-black border-r border-white/10 p-5 flex flex-col">
            <div className="avatar-circle text-xl w-14 h-14 mb-3">{me.avatarEmoji}</div>
            <p className="font-bold">{me.ghostId}</p>
            <p className="text-xs text-white/40 mb-4">{me.campus}</p>

            <div className="flex gap-4 mb-5 text-sm">
              <div>
                <span className="font-bold">{me.followingCount}</span>{" "}
                <span className="text-white/40">Following</span>
              </div>
              <div>
                <span className="font-bold">{me.followersCount}</span>{" "}
                <span className="text-white/40">Followers</span>
              </div>
            </div>

            <button
              className="text-left py-2 text-sm"
              onClick={() => {
                setShowDrawer(false)
                router.push("/lair")
              }}
            >
              👻 My Lair
            </button>
            <button
              className="text-left py-2 text-sm"
              onClick={() => {
                setShowDrawer(false)
                setShowNameModal(true)
              }}
            >
              ✏️ Edit ghost name
            </button>
            <button className="text-left py-2 text-sm text-white/40" disabled>
              🏘️ Communities <span className="text-xs">(soon)</span>
            </button>
            <button className="text-left py-2 text-sm text-white/40" disabled>
              👑 Prime Beta List <span className="text-xs">(soon — Prime only)</span>
            </button>

            <div className="mt-auto">
              <button className="btn-ghost w-full" onClick={handleLogout}>
                Log out
              </button>
            </div>
          </div>
          <div className="flex-1 bg-black/60" onClick={() => setShowDrawer(false)} />
        </div>
      )}

      {/* Name change modal */}
      {showNameModal && (
        <div className="fixed inset-0 bg-black/70 flex items-center justify-center z-50 px-4">
          <div className="card p-5 w-full max-w-sm bg-black">
            <h3 className="font-bold text-lg mb-1">Change your ghost name</h3>
            <p className="text-white/50 text-sm mb-4">Costs GHS 3.00 via Paystack.</p>
            <input
              className="input mb-3"
              placeholder="New ghost name"
              value={newName}
              onChange={(e) => setNewName(e.target.value)}
            />
            <div className="flex gap-2">
              <button className="btn-ghost flex-1" onClick={() => setShowNameModal(false)}>
                Cancel
              </button>
              <button className="btn-primary flex-1" onClick={handleNameChange}>
                Pay & Change
              </button>
            </div>
          </div>
        </div>
      )}
    </main>
  )
}