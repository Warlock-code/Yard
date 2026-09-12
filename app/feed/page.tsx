"use client"

import { useEffect, useState } from "react"
import { useRouter } from "next/navigation"
import { apiGet, apiPost } from "@/lib/useApi"

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

export default function FeedPage() {
  const router = useRouter()
  const [posts, setPosts] = useState<Post[]>([])
  const [mode, setMode] = useState("campus")
  const [loading, setLoading] = useState(true)
  const [composeText, setComposeText] = useState("")
  const [posting, setPosting] = useState(false)

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
    loadFeed()
  }, [mode])

  async function handlePost() {
    if (!composeText.trim()) return
    setPosting(true)
    try {
      await apiPost("/api/posts", { text: composeText, type: "confession" })
      setComposeText("")
      loadFeed()
    } catch (err: any) {
      alert(err.message)
    } finally {
      setPosting(false)
    }
  }

  async function handleVote(postId: string) {
    try {
      await apiPost(`/api/posts/${postId}/vote`, {})
      setPosts((prev) =>
        prev.map((p) => (p.id === postId ? { ...p, yeahs: p.yeahs + 1 } : p))
      )
    } catch (err: any) {
      alert(err.message)
    }
  }

  return (
    <main className="min-h-screen max-w-lg mx-auto pb-24">
      {/* Header tabs */}
      <div className="sticky top-0 bg-black/80 backdrop-blur border-b border-white/10 px-4 py-3 flex gap-4 z-10">
        {["campus", "program", "following", "all"].map((m) => (
          <button
            key={m}
            onClick={() => setMode(m)}
            className={`text-sm font-semibold capitalize ${
              mode === m ? "text-white" : "text-white/40"
            }`}
          >
            {m === "campus" ? "My Campus" : m}
          </button>
        ))}
      </div>

      {/* Compose box */}
      <div className="card m-4 p-4">
        <textarea
          className="input resize-none"
          placeholder="What's the gist?"
          rows={3}
          value={composeText}
          onChange={(e) => setComposeText(e.target.value)}
        />
        <div className="flex justify-end mt-2">
          <button
            className="btn-primary px-6"
            onClick={handlePost}
            disabled={posting || !composeText.trim()}
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
        <div className="space-y-3 px-4">
          {posts.map((post) => (
            <div key={post.id} className="card p-4">
              <div className="flex items-center gap-2 mb-2">
                <span className="text-xl">{post.user.avatarEmoji}</span>
                <span className="font-semibold">{post.user.ghostId}</span>
                {post.user.tier === "PRIME" && (
                  <span className="text-xs bg-yellow-500/20 text-yellow-400 px-2 py-0.5 rounded-full">
                    Prime
                  </span>
                )}
                {post.boosted && (
                  <span className="text-xs bg-purple-500/20 text-purple-400 px-2 py-0.5 rounded-full">
                    Boosted
                  </span>
                )}
              </div>

              {post.text && <p className="text-white/90 mb-3 whitespace-pre-wrap">{post.text}</p>}
              {post.imageUrl && (
                <img src={post.imageUrl} className="rounded-lg mb-3 w-full" alt="" />
              )}

              <div className="flex gap-4 text-sm text-white/50">
                <button onClick={() => handleVote(post.id)} className="hover:text-white">
                  🔥 {post.yeahs}
                </button>
                <button
                  onClick={() => router.push(`/post/${post.id}`)}
                  className="hover:text-white"
                >
                  💬 {post.commentsCount}
                </button>
              </div>
            </div>
          ))}
        </div>
      )}
    </main>
  )
}