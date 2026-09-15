"use client"

import { useEffect, useState } from "react"
import { useRouter } from "next/navigation"
import { apiGet } from "@/lib/useApi"
import { timeAgo } from "@/lib/timeAgo"

type Post = {
  id: string
  text: string | null
  imageUrl: string | null
  yeahs: number
  commentsCount: number
  createdAt: string
  user: { ghostId: string; avatarEmoji: string; tier: string }
}

export default function ActivityPage() {
  const router = useRouter()
  const [tab, setTab] = useState<"posts" | "liked">("posts")
  const [posts, setPosts] = useState<Post[]>([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    setLoading(true)
    apiGet(`/api/profile/activity?type=${tab}`)
      .then((d) => setPosts(d.posts))
      .catch(console.error)
      .finally(() => setLoading(false))
  }, [tab])

  return (
    <main className="min-h-screen max-w-lg mx-auto pb-28 px-4">
      <div className="flex items-center gap-3 pt-5 pb-3">
        <button onClick={() => router.back()} className="text-white/60">←</button>
        <h1 className="text-xl font-bold">My Activity</h1>
      </div>

      <div className="flex gap-2 mb-4">
        <button onClick={() => setTab("posts")} className={`text-xs px-4 py-2 rounded-full border ${tab === "posts" ? "border-[#baff39] text-[#baff39]" : "border-white/10 text-white/40"}`}>My Posts</button>
        <button onClick={() => setTab("liked")} className={`text-xs px-4 py-2 rounded-full border ${tab === "liked" ? "border-[#baff39] text-[#baff39]" : "border-white/10 text-white/40"}`}>Liked</button>
      </div>

      {loading ? (
        <p className="text-white/40 text-center mt-8">Loading...</p>
      ) : posts.length === 0 ? (
        <p className="text-white/40 text-center mt-8">Nothing here yet.</p>
      ) : (
        posts.map((p) => (
          <div key={p.id} className="border-b border-white/[0.06] py-3">
            <div className="flex items-center gap-2 text-sm mb-1">
              <span>{p.user.avatarEmoji}</span>
              <span className="font-semibold">{p.user.ghostId}</span>
              <span className="text-white/30">· {timeAgo(p.createdAt)}</span>
            </div>
            {p.text && <p className="text-white/90 text-sm">{p.text}</p>}
            <div className="flex gap-4 text-xs text-white/40 mt-1">
              <span>🔥 {p.yeahs}</span>
              <span>💬 {p.commentsCount}</span>
            </div>
          </div>
        ))
      )}
    </main>
  )
}