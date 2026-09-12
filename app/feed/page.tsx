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
  user: { ghostId: string; avatarEmoji: string; tier: string }
}

type Me = {
  id: string
  ghostId: string
  campus: string
  tier: string
  streakCount: number
}

export default function FeedPage() {
  const router = useRouter()
  const [me, setMe] = useState<Me | null>(null)
  const [posts, setPosts] = useState<Post[]>([])
  const [mode, setMode] = useState("campus")
  const [loading, setLoading] = useState(true)
  const [composeText, setComposeText] = useState("")
  const [composeImage, setComposeImage] = useState<string | null>(null)
  const [posting, setPosting] = useState(false)
  const [showNameModal, setShowNameModal] = useState(false)
  const [newName, setNewName] = useState("")

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

  async function handleNameChange() {
    if (!newName.trim()) return
    try {
      const data = await apiPost("/api/shop/custom-name", { newName })
      if (data.authorization_url) {
        window.location.href = data.authorization_url
      }
    } catch (err: any) {
      alert(err.message)
    }
  }

  function handleImagePick(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0]
    if (file) startUpload([file])
  }

  return (
    <main className="min-h-screen max-w-lg mx-auto pb-24">
      {/* Top bar — identity */}
      {me && (
        <div className="flex items-center justify-between px-4 py-3 border-b border-white/10">
          <div className="flex items-center gap-3">
            <div className="avatar-circle">👻</div>
            <div>
              <div className="flex items-center gap-2">
                <span className="font-semibold">{me.ghostId}</span>
                {me.tier === "PRIME" && <span className="badge badge-prime">Prime</span>}
              </div>
              <p className="text-xs text-white/40">
                {me.campus} · 🔥 {me.streakCount} day streak
              </p>
            </div>
          </div>
          <button className="btn-ghost" onClick={() => setShowNameModal(true)}>
            Edit name
          </button>
        </div>
      )}

      {/* Header tabs */}
      <div className="sticky top-0 bg-black/90 backdrop-blur border-b border-white/10 px-4 flex gap-5 z-10">
        {["campus", "program", "following", "all"].map((m) => (
          <button
            key={m}
            onClick={() => setMode(m)}
            className={`text-sm font-semibold capitalize py-3 ${
              mode === m ? "tab-active" : "tab-inactive"
            }`}
          >
            {m === "campus" ? "My Campus" : m}
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
              </div>
            </div>
          ))}
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