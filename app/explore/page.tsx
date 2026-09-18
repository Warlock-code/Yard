"use client"

import { useState, useEffect } from "react"
import { useRouter } from "next/navigation"
import Link from "next/link"
import Image from "next/image"
import SearchBar from "@/app/components/SearchBar"
import { timeAgo } from "@/lib/timeAgo"
import RichText from "@/app/components/RichText"

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
  hashtags: { hashtag: { tag: string } }[]
}

type Hashtag = {
  id: string
  tag: string
  postsCount: number
  trendingScore: number
}

type User = {
  id: string
  ghostId: string
  avatarEmoji: string
  tier: string
  _count: { followers: number; posts: number }
}

type TrendingData = {
  hashtags: Hashtag[]
  posts: Post[]
  suggestedGhosts: User[]
  window: string
}

const WINDOWS = [
  { key: "24h", label: "Last 24h" },
  { key: "7d", label: "Last 7d" },
]

export default function ExplorePage() {
  const router = useRouter()
  const [window, setWindow] = useState<"24h" | "7d">("24h")
  const [data, setData] = useState<TrendingData | null>(null)
  const [loading, setLoading] = useState(true)
  const [activeSection, setActiveSection] = useState<"trending" | "hashtags" | "ghosts">("trending")

  async function fetchTrending() {
    setLoading(true)
    try {
      const res = await fetch(`/api/trending?window=${window}&limit=15`)
      if (res.ok) {
        const result = await res.json()
        setData(result)
      }
    } catch (err) {
      console.error(err)
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    fetchTrending()
  }, [window])

  if (loading) {
    return (
      <main className="min-h-screen max-w-lg mx-auto pb-28 px-4 py-6">
        <div className="mb-4">
          <SearchBar placeholder="Search posts, ghosts, hashtags..." campus="" />
        </div>
        <div className="sticky top-0 bg-black/80 backdrop-blur border-b border-white/10 z-10 mb-4 rounded-xl p-1 flex gap-1">
          {WINDOWS.map((w) => (
            <button
              key={w.key}
              onClick={() => setWindow(w.key as "24h" | "7d")}
              className={`flex-1 py-2 px-3 rounded-lg text-sm font-medium transition-all ${
                window === w.key
                  ? "bg-[#baff39]/15 text-[#baff39]"
                  : "text-white/50 hover:text-white/80 hover:bg-white/5"
              }`}
            >
              {w.label}
            </button>
          ))}
        </div>
        <div className="space-y-4" aria-busy="true">
          {[...Array(3)].map((_, i) => (
            <div key={i} className="animate-pulse bg-white/5 rounded-xl p-4 border border-white/10">
              <div className="h-4 w-1/4 bg-white/10 rounded mb-3" />
              <div className="space-y-2">
                <div className="h-4 w-full bg-white/10 rounded" />
                <div className="h-4 w-3/4 bg-white/10 rounded" />
              </div>
            </div>
          ))}
        </div>
      </main>
    )
  }

  return (
    <main className="min-h-screen max-w-lg mx-auto pb-28 px-4 py-4">
      <div className="mb-4">
        <SearchBar placeholder="Search posts, ghosts, hashtags..." campus="" />
      </div>

      <div className="sticky top-0 bg-black/80 backdrop-blur border-b border-white/10 z-10 mb-4 rounded-xl p-1 flex gap-1">
        {WINDOWS.map((w) => (
          <button
            key={w.key}
            onClick={() => setWindow(w.key as "24h" | "7d")}
            className={`flex-1 py-2 px-3 rounded-lg text-sm font-medium transition-all ${
              window === w.key
                ? "bg-[#baff39]/15 text-[#baff39]"
                : "text-white/50 hover:text-white/80 hover:bg-white/5"
            }`}
          >
            {w.label}
          </button>
        ))}
      </div>

      <div className="sticky top-12 bg-black/80 backdrop-blur border-b border-white/10 z-10 mb-4 rounded-xl p-1 flex gap-1">
        <button
          onClick={() => setActiveSection("trending")}
          className={`flex-1 py-2 px-3 rounded-lg text-sm font-medium transition-all ${
            activeSection === "trending"
              ? "bg-[#baff39]/15 text-[#baff39]"
              : "text-white/50 hover:text-white/80 hover:bg-white/5"
          }`}
        >
          Trending Posts
        </button>
        <button
          onClick={() => setActiveSection("hashtags")}
          className={`flex-1 py-2 px-3 rounded-lg text-sm font-medium transition-all ${
            activeSection === "hashtags"
              ? "bg-[#baff39]/15 text-[#baff39]"
              : "text-white/50 hover:text-white/80 hover:bg-white/5"
          }`}
        >
          Hashtags
        </button>
        <button
          onClick={() => setActiveSection("ghosts")}
          className={`flex-1 py-2 px-3 rounded-lg text-sm font-medium transition-all ${
            activeSection === "ghosts"
              ? "bg-[#baff39]/15 text-[#baff39]"
              : "text-white/50 hover:text-white/80 hover:bg-white/5"
          }`}
        >
          Ghosts
        </button>
      </div>

      {activeSection === "trending" && (
        <section aria-labelledby="trending-heading">
          <h2 id="trending-heading" className="sr-only">Trending Posts</h2>
          {data?.posts.length === 0 ? (
            <div className="text-center mt-14 px-8">
              <p className="text-3xl mb-3">📈</p>
              <p className="text-white/50 text-sm">No trending posts yet. Be the first to spark a conversation!</p>
            </div>
          ) : (
            <div className="space-y-0">
              {data?.posts.map((post) => (
                <article key={post.id} className="px-4 py-3 border-b border-white/[0.06] hover:bg-white/[0.02]">
                  <Link href={`/post/${post.id}`} aria-label={`Open post by ${post.user.ghostId}`} className="absolute inset-0 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-[#baff39]" />
                  <div className="flex items-start gap-3 relative z-10">
                    <Link href={`/u/${encodeURIComponent(post.user.ghostId)}`} className="flex-shrink-0">
                      <div className="avatar-circle text-base">{post.user.avatarEmoji}</div>
                    </Link>
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2 flex-wrap text-sm">
                        <Link href={`/u/${encodeURIComponent(post.user.ghostId)}`} className="font-semibold">
                          {post.user.ghostId}
                        </Link>
                        {post.user.tier === "PRIME" && <span className="badge badge-prime">Prime</span>}
                        {post.boosted && <span className="badge badge-boosted">Boosted</span>}
                        <span className="text-white/30">· {timeAgo(post.createdAt)}</span>
                      </div>

                      {post.text && (
                        <p className="text-white/90 mt-1 whitespace-pre-wrap leading-snug line-clamp-3">
                          <RichText text={post.text} />
                        </p>
                      )}
                      {post.imageUrl && (
                        <div className="relative w-full max-h-64 mt-2">
                          <Image
                            src={post.imageUrl}
                            alt=""
                            fill
                            className="rounded-xl w-full h-full object-cover"
                            sizes="(max-width: 768px) 100vw, 50vw"
                          />
                        </div>
                      )}

                      {post.hashtags && post.hashtags.length > 0 && (
                        <div className="flex flex-wrap gap-1 mt-2">
                          {post.hashtags.slice(0, 3).map((h) => (
                            <Link
                              key={h.hashtag.tag}
                              href={`/search?q=%23${encodeURIComponent(h.hashtag.tag)}&tab=hashtags`}
                              className="text-xs text-[#baff39]/80 hover:text-[#baff39] underline-offset-2 hover:underline"
                            >
                              #{h.hashtag.tag}
                            </Link>
                          ))}
                        </div>
                      )}

                      <div className="flex flex-wrap items-center gap-x-5 gap-y-2 text-sm text-white/70 pt-2">
                        <span className="text-orange-200 flex items-center gap-1">🔥 {post.yeahs}</span>
                        <span className="text-sky-200 flex items-center gap-1">💬 {post.commentsCount}</span>
                        <span className="text-white/40 text-xs">Tap to open</span>
                      </div>
                    </div>
                  </div>
                </article>
              ))}
            </div>
          )}
        </section>
      )}

      {activeSection === "hashtags" && (
        <section aria-labelledby="hashtags-heading">
          <h2 id="hashtags-heading" className="sr-only">Trending Hashtags</h2>
          {data?.hashtags.length === 0 ? (
            <div className="text-center mt-14 px-8">
              <p className="text-3xl mb-3">#</p>
              <p className="text-white/50 text-sm">No trending hashtags yet.</p>
            </div>
          ) : (
            <div className="grid grid-cols-2 gap-3 px-1">
              {data?.hashtags.map((ht, index) => (
                <Link
                  key={ht.id}
                  href={`/search?q=%23${encodeURIComponent(ht.tag)}&tab=posts`}
                  className="bg-white/5 border border-white/10 rounded-xl p-4 hover:border-[#baff39]/30 hover:bg-white/10 transition-all group"
                >
                  <div className="flex items-center justify-between mb-2">
                    <span className="text-xl font-bold text-white/90 group-hover:text-[#baff39] transition-colors">
                      #{ht.tag}
                    </span>
                    <span className="text-xs text-white/40 bg-white/5 px-2 py-0.5 rounded-full">
                      #{index + 1}
                    </span>
                  </div>
                  <div className="flex items-center justify-between text-xs text-white/50">
                    <span>{ht.postsCount} posts</span>
                    <span className="text-[#baff39]/80 font-medium">{ht.trendingScore.toFixed(1)}</span>
                  </div>
                </Link>
              ))}
            </div>
          )}
        </section>
      )}

      {activeSection === "ghosts" && (
        <section aria-labelledby="ghosts-heading">
          <h2 id="ghosts-heading" className="sr-only">Suggested Ghosts</h2>
          {data?.suggestedGhosts.length === 0 ? (
            <div className="text-center mt-14 px-8">
              <p className="text-3xl mb-3">👻</p>
              <p className="text-white/50 text-sm">No suggestions right now. Check back later!</p>
            </div>
          ) : (
            <div className="space-y-0">
              {data?.suggestedGhosts.map((user) => (
                <Link
                  key={user.id}
                  href={`/u/${encodeURIComponent(user.ghostId)}`}
                  className="block px-4 py-3 border-b border-white/[0.06] hover:bg-white/[0.02]"
                >
                  <div className="flex items-center gap-3">
                    <div className="avatar-circle text-lg">{user.avatarEmoji}</div>
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2">
                        <span className="font-semibold">{user.ghostId}</span>
                        {user.tier === "PRIME" && <span className="badge badge-prime">Prime</span>}
                      </div>
                      <p className="text-white/40 text-sm mt-0.5">
                        {user._count.followers} follower{user._count.followers !== 1 ? "s" : ""} · {user._count.posts} post{user._count.posts !== 1 ? "s" : ""}
                      </p>
                    </div>
                    <button
                      onClick={(e) => {
                        e.preventDefault()
                        e.stopPropagation()
                        router.push(`/u/${encodeURIComponent(user.ghostId)}`)
                      }}
                      className="btn-ghost text-xs px-3 py-1.5 text-white/70 hover:text-[#baff39] border-white/20 hover:border-[#baff39]/50"
                    >
                      Follow
                    </button>
                  </div>
                </Link>
              ))}
            </div>
          )}
        </section>
      )}
    </main>
  )
}