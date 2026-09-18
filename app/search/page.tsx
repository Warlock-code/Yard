"use client"

import { useState, useEffect, useCallback, Suspense } from "react"
import { useRouter, useSearchParams } from "next/navigation"
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

type User = {
  id: string
  ghostId: string
  avatarEmoji: string
  tier: string
  _count: { followers: number; posts: number }
}

type Hashtag = {
  id: string
  tag: string
  postsCount: number
  trendingScore: number
}

type SearchResult = {
  posts: Post[]
  total: number
  page: number
  totalPages: number
  users?: User[]
  hashtags?: Hashtag[]
}

const TABS = [
  { key: "posts", label: "Posts", icon: "📝" },
  { key: "people", label: "People", icon: "👻" },
  { key: "hashtags", label: "Hashtags", icon: "#" },
]

export default function SearchPage() {
  const router = useRouter()
  const searchParams = useSearchParams()
  const [activeTab, setActiveTab] = useState(searchParams.get("tab") || "posts")
  const [query, setQuery] = useState(searchParams.get("q") || "")
  const [results, setResults] = useState<SearchResult>({ posts: [], total: 0, page: 1, totalPages: 0 })
  const [loading, setLoading] = useState(true)
  const [loadingMore, setLoadingMore] = useState(false)
  const [nextCursor, setNextCursor] = useState<string | null>(null)
  const [filters, setFilters] = useState({
    type: searchParams.get("type") || "all",
    dateFrom: searchParams.get("dateFrom") || "",
    dateTo: searchParams.get("dateTo") || "",
    sortBy: (searchParams.get("sortBy") as "relevance" | "recent" | "engagement") || "relevance",
  })

  const campus = searchParams.get("campus") || ""
  const hashtagFilter = searchParams.get("hashtag") || ""

  const fetchResults = useCallback(async (page = 1, append = false) => {
    if (!query.trim()) {
      setResults({ posts: [], total: 0, page: 1, totalPages: 0 })
      setLoading(false)
      return
    }

    if (!append) setLoading(true)
    else setLoadingMore(true)

    try {
      const params = new URLSearchParams()
      params.set("q", query)
      params.set("tab", activeTab)
      params.set("page", page.toString())
      params.set("limit", "20")
      params.set("sortBy", filters.sortBy)
      if (campus) params.set("campus", campus)
      if (filters.type !== "all") params.set("type", filters.type)
      if (hashtagFilter) params.set("hashtag", hashtagFilter)
      if (filters.dateFrom) params.set("dateFrom", filters.dateFrom)
      if (filters.dateTo) params.set("dateTo", filters.dateTo)

      const res = await fetch(`/api/search?${params.toString()}`)
      if (!res.ok) throw new Error("Search failed")

      const data = await res.json()

      if (append && data.posts) {
        setResults((prev) => ({
          ...data,
          posts: [...prev.posts, ...data.posts],
        }))
      } else {
        setResults(data)
      }
      setNextCursor(data.posts?.length === 20 ? data.posts[data.posts.length - 1]?.id : null)
    } catch (err) {
      console.error(err)
      if (!append) setResults({ posts: [], total: 0, page: 1, totalPages: 0 })
    } finally {
      setLoading(false)
      setLoadingMore(false)
    }
  }, [query, activeTab, campus, hashtagFilter, filters])

  useEffect(() => {
    fetchResults(1, false)
  }, [fetchResults])

  useEffect(() => {
    const newTab = searchParams.get("tab") || "posts"
    if (newTab !== activeTab) {
      setActiveTab(newTab)
    }
    const newQuery = searchParams.get("q") || ""
    if (newQuery !== query) {
      setQuery(newQuery)
    }
  }, [searchParams])

  function handleSearch(q: string) {
    setQuery(q)
    const params = new URLSearchParams(searchParams.toString())
    params.set("q", q)
    params.set("tab", "posts")
    params.delete("page")
    router.push(`/search?${params.toString()}`)
  }

  function handleTabChange(tab: string) {
    if (tab === activeTab) return
    setActiveTab(tab)
    const params = new URLSearchParams(searchParams.toString())
    params.set("tab", tab)
    params.delete("page")
    router.push(`/search?${params.toString()}`)
  }

  function handleFilterChange(key: string, value: string) {
    setFilters((prev) => ({ ...prev, [key]: value }))
    const params = new URLSearchParams(searchParams.toString())
    if (value) params.set(key, value)
    else params.delete(key)
    params.delete("page")
    router.push(`/search?${params.toString()}`)
  }

  function handleLoadMore() {
    if (loadingMore || !nextCursor) return
    fetchResults(results.page + 1, true)
  }

  const posts = results.posts || []
  const users = results.users || []
  const hashtags = results.hashtags || []

  if (loading) {
    return (
      <main className="min-h-screen max-w-lg mx-auto pb-28 px-4 py-6">
        <SearchBar initialQuery={query} onSearch={handleSearch} campus={campus} />
        <div className="mt-6 space-y-4" aria-busy="true">
          {[...Array(5)].map((_, i) => (
            <div key={i} className="animate-pulse bg-white/5 rounded-xl p-4 border border-white/10">
              <div className="flex gap-3">
                <div className="w-10 h-10 rounded-full bg-white/10" />
                <div className="flex-1 space-y-2">
                  <div className="h-4 w-1/3 bg-white/10 rounded" />
                  <div className="h-4 w-full bg-white/10 rounded" />
                  <div className="h-4 w-3/4 bg-white/10 rounded" />
                </div>
              </div>
            </div>
          ))}
        </div>
      </main>
    )
  }

  return (
    <main className="min-h-screen max-w-lg mx-auto pb-28 px-4 py-4">
      <SearchBar
        initialQuery={query}
        onSearch={handleSearch}
        campus={campus}
        placeholder="Search posts, ghosts, hashtags..."
        className="mb-4"
      />

      <div className="sticky top-0 bg-black/80 backdrop-blur border-b border-white/10 z-10 mb-4 rounded-xl p-1 flex gap-1">
        {TABS.map((tab) => (
          <button
            key={tab.key}
            onClick={() => handleTabChange(tab.key)}
            className={`flex-1 flex items-center justify-center gap-1.5 py-2 px-3 rounded-lg text-sm font-medium transition-all ${
              activeTab === tab.key
                ? "bg-[#baff39]/15 text-[#baff39]"
                : "text-white/50 hover:text-white/80 hover:bg-white/5"
            }`}
            aria-selected={activeTab === tab.key}
            role="tab"
          >
            <span aria-hidden="true">{tab.icon}</span>
            <span>{tab.label}</span>
            {activeTab === tab.key && results.total > 0 && (
              <span className="text-xs bg-white/10 px-1.5 py-0.5 rounded-full">{results.total}</span>
            )}
          </button>
        ))}
      </div>

      {activeTab === "posts" && (
        <>
          <div className="flex items-center justify-between text-sm text-white/50 mb-3 px-1">
            <span>{results.total} result{results.total !== 1 ? "s" : ""}</span>
            <select
              value={filters.sortBy}
              onChange={(e) => handleFilterChange("sortBy", e.target.value)}
              className="bg-white/5 border border-white/10 rounded-lg px-3 py-1 text-white text-xs focus:outline-none focus:border-[#baff39]/50"
            >
              <option value="relevance">Relevance</option>
              <option value="recent">Most Recent</option>
              <option value="engagement">Top Engagement</option>
            </select>
          </div>

          {posts.length === 0 ? (
            <div className="text-center mt-14 px-8">
              <p className="text-3xl mb-3">🔍</p>
              <p className="text-white/50 text-sm">No posts found for "{query}"</p>
            </div>
          ) : (
            <div className="space-y-0">
              {posts.map((post) => (
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
                        <p className="text-white/90 mt-1 whitespace-pre-wrap leading-snug">
                          <RichText text={post.text} />
                        </p>
                      )}
                      {post.imageUrl && (
                        <div className="relative w-full max-h-96 mt-2">
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
                          {post.hashtags.map((h) => (
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
                        <span className="text-orange-200">🔥 {post.yeahs}</span>
                        <span className="text-sky-200">💬 {post.commentsCount}</span>
                        <span className="text-white/40 text-xs">Tap to open</span>
                      </div>
                    </div>
                  </div>
                </article>
              ))}
              {loadingMore && <p className="text-center text-white/30 text-sm py-4">Loading more...</p>}
              {!loadingMore && nextCursor && (
                <button
                  onClick={handleLoadMore}
                  className="w-full py-3 text-white/50 hover:text-white/80 text-sm font-medium border-t border-white/10 mt-2"
                >
                  Load more
                </button>
              )}
            </div>
          )}
        </>
      )}

      {activeTab === "people" && (
        <div className="space-y-0">
          {users.length === 0 ? (
            <div className="text-center mt-14 px-8">
              <p className="text-3xl mb-3">👻</p>
              <p className="text-white/50 text-sm">No ghosts found for "{query}"</p>
            </div>
          ) : (
            users.map((user) => (
              <Link key={user.id} href={`/u/${encodeURIComponent(user.ghostId)}`} className="block px-4 py-3 border-b border-white/[0.06] hover:bg-white/[0.02]">
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
                  <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" className="text-white/30">
                    <path d="M9 18l6-6-6-6" />
                  </svg>
                </div>
              </Link>
            ))
          )}
        </div>
      )}

      {activeTab === "hashtags" && (
        <div className="space-y-0">
          {hashtags.length === 0 ? (
            <div className="text-center mt-14 px-8">
              <p className="text-3xl mb-3">#</p>
              <p className="text-white/50 text-sm">No hashtags found for "{query}"</p>
            </div>
          ) : (
            hashtags.map((ht) => (
              <Link key={ht.id} href={`/search?q=%23${encodeURIComponent(ht.tag)}&tab=posts`} className="block px-4 py-3 border-b border-white/[0.06] hover:bg-white/[0.02]">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-3">
                    <span className="text-2xl">#</span>
                    <div>
                      <p className="font-semibold text-white/90">#{ht.tag}</p>
                      <p className="text-white/40 text-sm">{ht.postsCount} post{ht.postsCount !== 1 ? "s" : ""}</p>
                    </div>
                  </div>
                  <span className="text-xs text-white/30 bg-white/5 px-2 py-1 rounded">Trending: {ht.trendingScore.toFixed(1)}</span>
                </div>
              </Link>
            ))
          )}
        </div>
      )}
    </main>
  )
}