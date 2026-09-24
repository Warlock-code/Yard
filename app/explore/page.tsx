"use client"

import { useState, useEffect, Suspense } from "react"
import Link from "next/link"
import SearchBar from "@/app/components/SearchBar"
import { timeAgo } from "@/lib/timeAgo"
import RichText from "@/app/components/RichText"
import OptimizedImage from "@/app/components/OptimizedImage"
import Avatar from "@/app/components/Avatar"
import ChampionTrophies from "@/app/components/ChampionTrophies"

function SearchBarWrapper({ campus }: { campus: string }) {
  return <SearchBar placeholder="Search posts, ghosts, hashtags..." campus={campus} />
}

type Post = {
  id: string
  text: string | null
  imageUrl: string | null
  type: string
  yeahs: number
  commentsCount: number
  boosted: boolean
  createdAt: string
  user: { id: string; ghostId: string; avatarEmoji: string; tier: string; championTrophies?: number }
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
  championTrophies?: number
  _count: { followers: number; posts: number }
}

type TrendingData = {
  hashtags: Hashtag[]
  posts: Post[]
  suggestedGhosts: User[]
  window: string
}

type SectionKey = "trending" | "hashtags" | "ghosts" | "media"

const WINDOWS = [
  { key: "24h", label: "Last 24h" },
  { key: "7d", label: "Last 7d" },
] as const

const SECTIONS: { key: SectionKey; label: string; icon: string }[] = [
  { key: "trending", label: "Posts", icon: "🔥" },
  { key: "hashtags", label: "Hashtags", icon: "#" },
  { key: "ghosts", label: "Ghosts", icon: "👻" },
  { key: "media", label: "Media", icon: "🖼️" },
]

function PostCard({ post }: { post: Post }) {
  return (
    <article className="px-4 py-3 border-b border-white/[0.06] hover:bg-white/[0.02] relative">
      <Link
        href={`/post/${post.id}`}
        aria-label={`Open post by ${post.user.ghostId}`}
        className="absolute inset-0 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-[#baff39]"
      />
      <div className="flex items-start gap-3 relative z-10">
        <Link href={`/u/${encodeURIComponent(post.user.ghostId)}`} className="flex-shrink-0">
          <Avatar emoji={post.user.avatarEmoji} size={36} />
        </Link>
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2 flex-wrap text-sm">
            <Link href={`/u/${encodeURIComponent(post.user.ghostId)}`} className="font-semibold">
              {post.user.ghostId}
            </Link>
            {post.user.tier === "PRIME" && <span className="badge badge-prime">Prime</span>}
            {post.user.tier === "PLUS" && <span className="badge badge-plus">✓ Plus</span>}
            <ChampionTrophies trophies={post.user.championTrophies} className="text-[10px] leading-none" />
            {post.boosted && <span className="badge badge-boosted">Boosted</span>}
            <span className="text-white/30">· {timeAgo(post.createdAt)}</span>
          </div>

          {post.text && (
            <p className="post-mono text-white/90 mt-1 whitespace-pre-wrap leading-snug line-clamp-3">
              <RichText text={post.text} />
            </p>
          )}
          {post.imageUrl && (
            <div className="relative w-full max-h-64 mt-2">
              <OptimizedImage
                src={post.imageUrl}
                alt=""
                fill
                sizes="(max-width: 768px) 100vw, 50vw"
                rounded
              />
            </div>
          )}

          {post.hashtags && post.hashtags.length > 0 && (
            <div className="flex flex-wrap gap-1 mt-2">
              {post.hashtags.slice(0, 3).map((h) => (
                <Link
                  key={h.hashtag.tag}
                  href={`/search?q=%23${encodeURIComponent(h.hashtag.tag)}&tab=posts`}
                  className="text-xs text-primary/80 hover:text-primary underline-offset-2 hover:underline"
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
  )
}

export default function ExplorePage() {
  const [window, setWindow] = useState<"24h" | "7d">("24h")
  const [data, setData] = useState<TrendingData | null>(null)
  const [loading, setLoading] = useState(true)
  const [fetchError, setFetchError] = useState<string | null>(null)
  const [retryKey, setRetryKey] = useState(0)
  const [activeSection, setActiveSection] = useState<SectionKey>("trending")
  const [followed, setFollowed] = useState<Record<string, boolean>>({})
  const [followBusy, setFollowBusy] = useState<Record<string, boolean>>({})

  useEffect(() => {
    let cancelled = false
    fetch(`/api/trending?window=${window}&limit=15`)
      .then((res) => {
        if (!res.ok) throw new Error("Trending failed")
        return res.json()
      })
      .then((result) => {
        if (!cancelled) {
          setData(result)
          setFetchError(null)
        }
      })
      .catch((err) => {
        console.error(err)
        if (!cancelled) setFetchError("Couldn't load trending right now.")
      })
      .finally(() => {
        if (!cancelled) setLoading(false)
      })
    return () => {
      cancelled = true
    }
  }, [window, retryKey])

  function handleWindowChange(w: "24h" | "7d") {
    if (w === window) return
    setLoading(true)
    setFetchError(null)
    setWindow(w)
  }

  function handleRetry() {
    setLoading(true)
    setFetchError(null)
    setRetryKey((k) => k + 1)
  }

  async function toggleFollow(targetUserId: string) {
    if (followBusy[targetUserId]) return
    const prev = !!followed[targetUserId]
    setFollowed((p) => ({ ...p, [targetUserId]: !prev }))
    setFollowBusy((p) => ({ ...p, [targetUserId]: true }))
    try {
      const res = await fetch("/api/follow", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ targetUserId }),
      })
      if (!res.ok) throw new Error("follow failed")
      const result = await res.json()
      setFollowed((p) => ({ ...p, [targetUserId]: !!result.following }))
    } catch {
      setFollowed((p) => ({ ...p, [targetUserId]: prev }))
    } finally {
      setFollowBusy((p) => ({ ...p, [targetUserId]: false }))
    }
  }

  const mediaPosts = (data?.posts || []).filter((p) => p.imageUrl)

  function sectionCount(key: SectionKey): number | null {
    if (!data) return null
    if (key === "trending") return data.posts.length
    if (key === "hashtags") return data.hashtags.length
    if (key === "ghosts") return data.suggestedGhosts.length
    return mediaPosts.length
  }

  if (loading && !data) {
    return (
      <main className="min-h-screen max-w-lg mx-auto pb-28 px-4 py-6">
        <div className="mb-4">
          <Suspense fallback={<div className="h-10 w-full bg-white/5 border border-white/10 rounded-full animate-pulse" />}>
            <SearchBarWrapper campus="" />
          </Suspense>
        </div>
        <div className="sticky top-0 bg-black/80 backdrop-blur border-b border-white/10 z-10 mb-4 rounded-xl p-1 flex gap-1">
          {WINDOWS.map((w) => (
            <button
              key={w.key}
              onClick={() => handleWindowChange(w.key)}
              className={`flex-1 py-2 px-3 rounded-lg text-sm font-medium transition-all ${
                window === w.key
                  ? "bg-primary/15 text-primary"
                  : "text-white/50 hover:text-white/80 hover:bg-white/5"
              }`}
            >
              {w.label}
            </button>
          ))}
        </div>
        <div className="space-y-4" aria-busy="true" aria-label="Loading trending">
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
        <Suspense fallback={<div className="h-10 w-full bg-white/5 border border-white/10 rounded-full animate-pulse" />}>
          <SearchBarWrapper campus="" />
        </Suspense>
      </div>

      <div
        role="tablist"
        aria-label="Trending window"
        className="sticky top-0 bg-black/80 backdrop-blur border-b border-white/10 z-10 mb-4 rounded-xl p-1 flex gap-1"
      >
        {WINDOWS.map((w) => (
          <button
            key={w.key}
            role="tab"
            aria-selected={window === w.key}
            onClick={() => handleWindowChange(w.key)}
            className={`flex-1 py-2 px-3 rounded-lg text-sm font-medium transition-all focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary ${
              window === w.key
                ? "bg-primary/15 text-primary"
                : "text-white/50 hover:text-white/80 hover:bg-white/5"
            }`}
          >
            {w.label}
          </button>
        ))}
      </div>

      <div
        role="tablist"
        aria-label="Explore sections"
        className="sticky top-12 bg-black/80 backdrop-blur border-b border-white/10 z-10 mb-4 rounded-xl p-1 flex gap-1 overflow-x-auto"
      >
        {SECTIONS.map((s) => {
          const count = sectionCount(s.key)
          const selected = activeSection === s.key
          return (
            <button
              key={s.key}
              role="tab"
              aria-selected={selected}
              aria-controls={`explore-panel-${s.key}`}
              id={`explore-tab-${s.key}`}
              onClick={() => setActiveSection(s.key)}
              className={`flex-1 whitespace-nowrap flex items-center justify-center gap-1.5 py-2 px-3 rounded-lg text-sm font-medium transition-all focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary ${
                selected
                  ? "bg-primary/15 text-primary"
                  : "text-white/50 hover:text-white/80 hover:bg-white/5"
              }`}
            >
              <span aria-hidden="true">{s.icon}</span>
              <span>{s.label}</span>
              {count !== null && count > 0 && (
                <span
                  className={`text-[11px] px-1.5 py-0.5 rounded-full ${
                    selected ? "bg-primary/20 text-primary" : "bg-white/10 text-white/50"
                  }`}
                >
                  {count}
                </span>
              )}
            </button>
          )
        })}
      </div>

      {fetchError && !data ? (
        <div className="text-center mt-14 px-8">
          <p className="text-3xl mb-3">😵</p>
          <p className="text-white/50 text-sm mb-4">{fetchError}</p>
          <button
            type="button"
            onClick={handleRetry}
            className="btn-ghost text-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#baff39]"
          >
            Retry
          </button>
        </div>
      ) : (
        <>
          {activeSection === "trending" && (
            <section aria-labelledby="trending-heading" aria-label="Trending Posts" role="tabpanel" id="explore-panel-trending">
              <h2 id="trending-heading" className="sr-only">
                Trending Posts
              </h2>
              {data?.posts.length === 0 ? (
                <div className="text-center mt-14 px-8">
                  <p className="text-3xl mb-3">📈</p>
                  <p className="text-white/50 text-sm">No trending posts yet. Be the first to spark a conversation!</p>
                </div>
              ) : (
                <div className="border-t border-white/[0.06]">
                  {data?.posts.map((post) => (
                    <PostCard key={post.id} post={post} />
                  ))}
                </div>
              )}
            </section>
          )}

          {activeSection === "hashtags" && (
            <section aria-labelledby="hashtags-heading" role="tabpanel" id="explore-panel-hashtags">
              <h2 id="hashtags-heading" className="sr-only">
                Trending Hashtags
              </h2>
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
                      className="bg-white/5 border border-white/10 rounded-xl p-4 hover:border-primary/30 hover:bg-white/10 transition-all group focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary"
                    >
                      <div className="flex items-center justify-between mb-2">
                        <span className="text-xl font-bold text-white/90 group-hover:text-primary transition-colors truncate">
                          #{ht.tag}
                        </span>
                        <span className="text-xs text-white/40 bg-white/5 px-2 py-0.5 rounded-full">
                          #{index + 1}
                        </span>
                      </div>
                      <div className="flex items-center justify-between text-xs text-white/50">
                        <span>{ht.postsCount} posts</span>
                        <span className="text-primary/80 font-medium">{ht.trendingScore.toFixed(1)}</span>
                      </div>
                    </Link>
                  ))}
                </div>
              )}
            </section>
          )}

          {activeSection === "ghosts" && (
            <section aria-labelledby="ghosts-heading" role="tabpanel" id="explore-panel-ghosts">
              <h2 id="ghosts-heading" className="sr-only">
                Suggested Ghosts
              </h2>
              {data?.suggestedGhosts.length === 0 ? (
                <div className="text-center mt-14 px-8">
                  <p className="text-3xl mb-3">👻</p>
                  <p className="text-white/50 text-sm">No suggestions right now. Check back later!</p>
                </div>
              ) : (
                <div className="border-t border-white/[0.06] divide-y divide-white/[0.06]">
                  {data?.suggestedGhosts.map((user) => {
                    const isFollowing = !!followed[user.id]
                    const busy = !!followBusy[user.id]
                    return (
                      <div
                        key={user.id}
                        className="flex items-center gap-3 px-4 py-3 border-b border-white/[0.06] hover:bg-white/[0.02]"
                      >
                        <Link href={`/u/${encodeURIComponent(user.ghostId)}`} className="flex-shrink-0">
                          <Avatar emoji={user.avatarEmoji} size={40} />
                        </Link>
                        <Link href={`/u/${encodeURIComponent(user.ghostId)}`} className="flex-1 min-w-0">
                          <div className="flex items-center gap-2">
                            <span className="font-semibold truncate">{user.ghostId}</span>
                            {user.tier === "PRIME" && <span className="badge badge-prime">Prime</span>}
                            {user.tier === "PLUS" && <span className="badge badge-plus">✓ Plus</span>}
                            <ChampionTrophies trophies={user.championTrophies} className="text-[10px] leading-none" />
                          </div>
                          <p className="text-white/40 text-sm mt-0.5">
                            {user._count.followers} follower{user._count.followers !== 1 ? "s" : ""} ·{" "}
                            {user._count.posts} post{user._count.posts !== 1 ? "s" : ""}
                          </p>
                        </Link>
                        <button
                          type="button"
                          onClick={() => toggleFollow(user.id)}
                          disabled={busy}
                          aria-pressed={isFollowing}
                          className={`flex-shrink-0 text-xs px-3 py-1.5 rounded-full border font-semibold transition-all focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary disabled:opacity-50 ${
                            isFollowing
                              ? "bg-primary/15 text-primary border-primary/30"
                              : "text-white/70 border-white/20 hover:text-primary hover:border-primary/50"
                          }`}
                        >
                          {isFollowing ? "Following" : "Follow"}
                        </button>
                      </div>
                    )
                  })}
                </div>
              )}
            </section>
          )}

          {activeSection === "media" && (
            <section aria-labelledby="media-heading" role="tabpanel" id="explore-panel-media">
              <h2 id="media-heading" className="sr-only">
                Trending Media
              </h2>
              {mediaPosts.length === 0 ? (
                <div className="text-center mt-14 px-8">
                  <p className="text-3xl mb-3">🖼️</p>
                  <p className="text-white/50 text-sm">No trending media yet.</p>
                </div>
              ) : (
                <div className="grid grid-cols-3 gap-1">
                  {mediaPosts.map((post) => (
                    <Link
                      key={post.id}
                      href={`/post/${post.id}`}
                      aria-label={`Open media post by ${post.user.ghostId}`}
                      className="relative aspect-square rounded-lg overflow-hidden bg-white/5 border border-white/10 hover:border-primary/30 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary"
                    >
                      {post.imageUrl && (
                        <OptimizedImage
                          src={post.imageUrl}
                          alt=""
                          fill
                          sizes="(max-width: 768px) 33vw, 170px"
                        />
                      )}
                      <span className="absolute bottom-1 left-1 text-[11px] bg-black/70 rounded-full px-1.5 py-0.5 text-orange-200">
                        🔥 {post.yeahs}
                      </span>
                    </Link>
                  ))}
                </div>
              )}
            </section>
          )}
        </>
      )}
    </main>
  )
}
