"use client"

import { useEffect, useState } from "react"
import { useRouter } from "next/navigation"
import Link from "next/link"
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
    let active = true
    apiGet(`/api/profile/activity?type=${tab}`)
      .then((d) => {
        if (active) setPosts(d.posts)
      })
      .catch(console.error)
      .finally(() => {
        if (active) setLoading(false)
      })
    return () => { active = false }
  }, [tab])

  function selectTab(nextTab: "posts" | "liked") {
    if (nextTab === tab) return
    setLoading(true)
    setTab(nextTab)
  }

  return (
    <main className="min-h-screen max-w-lg mx-auto pb-28 px-4">
      <div className="flex items-center gap-3 pt-5 pb-3">
        <button onClick={() => router.back()} className="text-white/60">←</button>
        <h1 className="text-xl font-bold">My Activity</h1>
      </div>

      <div className="flex gap-2 mb-4">
        <button onClick={() => selectTab("posts")} className={`text-xs px-4 py-2 rounded-full border ${tab === "posts" ? "border-primary text-primary" : "border-white/10 text-white/40"}`}>My Posts</button>
        <button onClick={() => selectTab("liked")} className={`text-xs px-4 py-2 rounded-full border ${tab === "liked" ? "border-primary text-primary" : "border-white/10 text-white/40"}`}>Liked</button>
      </div>

      {loading ? (
        <p className="text-white/40 text-center mt-8">Loading...</p>
      ) : posts.length === 0 ? (
        <p className="text-white/40 text-center mt-8">Nothing here yet.</p>
      ) : (
        posts.map((p) => (
          <div key={p.id} className="border-b border-white/[0.06] py-3 hover:bg-white/[0.02]">
            <div className="flex items-center gap-2 text-sm mb-1">
              <Link href={`/u/${encodeURIComponent(p.user.ghostId)}`} aria-label={`View ${p.user.ghostId}'s profile`} className="focus-visible:outline-[#baff39]">
                <span>{p.user.avatarEmoji}</span>
              </Link>
              <Link href={`/u/${encodeURIComponent(p.user.ghostId)}`} aria-label={`View ${p.user.ghostId}'s profile`} className="font-semibold focus-visible:outline-[#baff39]">
                {p.user.ghostId}
              </Link>
              <span className="text-white/30">· {timeAgo(p.createdAt)}</span>
            </div>
            <Link href={`/post/${p.id}`} aria-label={`Open post by ${p.user.ghostId}`} className="block focus-visible:outline-[#baff39]">
              {p.text && <p className="post-mono text-white/90 text-sm">{p.text}</p>}
              <div className="flex gap-4 text-xs text-white/40 mt-1">
                <span>🔥 {p.yeahs}</span>
                <span>💬 {p.commentsCount}</span>
              </div>
            </Link>
          </div>
        ))
      )}
    </main>
  )
}