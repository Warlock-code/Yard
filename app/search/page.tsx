"use client"

import { useState, useEffect, useCallback, useRef, Suspense } from "react"
import { useRouter, useSearchParams } from "next/navigation"
import Link from "next/link"
import SearchBar from "@/app/components/SearchBar"
import { timeAgo } from "@/lib/timeAgo"
import RichText from "@/app/components/RichText"
import OptimizedImage from "@/app/components/OptimizedImage"
import Avatar from "@/app/components/Avatar"
import ChampionTrophies from "@/app/components/ChampionTrophies"

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

type User = {
  id: string
  ghostId: string
  avatarEmoji: string
  tier: string
  championTrophies?: number
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

type TrendingData = {
  hashtags: Hashtag[]
  posts: Post[]
  suggestedGhosts: User[]
  window: string
}

type TabKey = "top" | "posts" | "people" | "hashtags" | "media"
type SortKey = "relevance" | "recent" | "engagement"

const TABS: { key: TabKey; label: string; icon: string }[] = [
  { key: "top", label: "Top", icon: "✨" },
  { key: "posts", label: "Posts", icon: "📝" },
  { key: "people", label: "People", icon: "👻" },
  { key: "hashtags", label: "Hashtags", icon: "#" },
  { key: "media", label: "Media", icon: "🖼️" },
]

const VALID_TABS = new Set<string>(TABS.map((t) => t.key))

const TYPE_CHIPS = [
  { key: "all", label: "All" },
  { key: "confession", label: "Confession" },
  { key: "gossip", label: "Gist" },
  { key: "meme", label: "Meme" },
]
const VALID_TYPES = new Set(TYPE_CHIPS.map((c) => c.key))

const SORT_LABELS: Record<SortKey, string> = {
  relevance: "Relevance",
  recent: "Recent",
  engagement: "Top Engagement",
}

const RECENT_KEY = "yard_recent_searches"
const RECENT_MAX = 8
const PAGE_LIMIT = 20
const COUNT_LIMIT = 20

function readRecents(): string[] {
  if (typeof window === "undefined") return []
  try {
    const raw = window.localStorage.getItem(RECENT_KEY)
    if (!raw) return []
    const parsed = JSON.parse(raw)
    if (!Array.isArray(parsed)) return []
    return parsed.filter((x): x is string => typeof x === "string").slice(0, RECENT_MAX)
  } catch {
    return []
  }
}

function formatBadge(count: number | null, capped: boolean): string | null {
  if (count === null || count === undefined) return null
  if (count <= 0) return null
  if (capped && count >= COUNT_LIMIT) return `${COUNT_LIMIT}+`
  return `${count}`
}

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
            <p className="post-mono text-white/90 mt-1 whitespace-pre-wrap leading-snug">
              <RichText text={post.text} />
            </p>
          )}
          {post.imageUrl && (
            <div className="relative w-full max-h-96 mt-2">
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
              {post.hashtags.map((h) => (
                <Link
                  key={h.hashtag.tag}
                  href={`/search?q=%23${encodeURIComponent(h.hashtag.tag)}&tab=posts`}
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
  )
}

function SkeletonList({ rows = 5 }: { rows?: number }) {
  return (
    <div className="mt-2 space-y-4" aria-busy="true" aria-label="Loading results">
      {[...Array(rows)].map((_, i) => (
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
  )
}

function SearchPageContent() {
  const router = useRouter()
  const searchParams = useSearchParams()

  const urlQ = searchParams.get("q") || ""
  const qTrim = urlQ.trim()
  const hasQuery = qTrim.length > 0

  const rawTab = searchParams.get("tab") || "posts"
  const activeTab: TabKey = VALID_TABS.has(rawTab) ? (rawTab as TabKey) : "posts"

  const rawSort = searchParams.get("sortBy")
  const sortBy: SortKey =
    rawSort === "recent" || rawSort === "engagement" || rawSort === "relevance"
      ? rawSort
      : "relevance"

  const rawType = searchParams.get("type") || "all"
  const typeFilter = VALID_TYPES.has(rawType) ? rawType : "all"

  const campus = searchParams.get("campus") || ""
  const hashtagFilter = searchParams.get("hashtag") || ""
  const dateFrom = searchParams.get("dateFrom") || ""
  const dateTo = searchParams.get("dateTo") || ""

  const [results, setResults] = useState<SearchResult>({ posts: [], total: 0, page: 1, totalPages: 0 })
  const [topPosts, setTopPosts] = useState<Post[]>([])
  const [topUsers, setTopUsers] = useState<User[]>([])
  const [topHashtags, setTopHashtags] = useState<Hashtag[]>([])
  const [tabCounts, setTabCounts] = useState<{
    posts: number | null
    people: number | null
    hashtags: number | null
    media: number | null
  }>({ posts: null, people: null, hashtags: null, media: null })

  const [loading, setLoading] = useState(false)
  const [loadingMore, setLoadingMore] = useState(false)
  const [nextCursor, setNextCursor] = useState<string | null>(null)
  const [fetchError, setFetchError] = useState<string | null>(null)

  const [exploreData, setExploreData] = useState<TrendingData | null>(null)
  const [exploreLoading, setExploreLoading] = useState(!hasQuery)

  const [recents, setRecents] = useState<string[]>(() => readRecents())
  const [followed, setFollowed] = useState<Record<string, boolean>>({})
  const [followBusy, setFollowBusy] = useState<Record<string, boolean>>({})

  const fetchSeq = useRef(0)
  const sentinelRef = useRef<HTMLDivElement | null>(null)

  function persistRecents(next: string[]) {
    setRecents(next)
    try {
      window.localStorage.setItem(RECENT_KEY, JSON.stringify(next))
    } catch {
      /* storage unavailable */
    }
  }

  function saveRecent(term: string) {
    const t = term.trim()
    if (!t) return
    setRecents((prev) => {
      const next = [t, ...prev.filter((x) => x.toLowerCase() !== t.toLowerCase())].slice(0, RECENT_MAX)
      try {
        window.localStorage.setItem(RECENT_KEY, JSON.stringify(next))
      } catch {
        /* ignore */
      }
      return next
    })
  }

  function removeRecent(term: string) {
    persistRecents(recents.filter((r) => r !== term))
  }

  function clearRecents() {
    persistRecents([])
  }

  function pushParams(mutator: (p: URLSearchParams) => void) {
    const params = new URLSearchParams(searchParams.toString())
    mutator(params)
    router.push(`/search?${params.toString()}`)
  }

  function handleSearch(q: string) {
    const t = q.trim()
    if (!t) return
    saveRecent(t)
    pushParams((p) => {
      p.set("q", t)
      if (!VALID_TABS.has(p.get("tab") || "")) p.set("tab", "posts")
      p.delete("page")
    })
  }

  function handleRecentRerun(term: string) {
    saveRecent(term)
    pushParams((p) => {
      p.set("q", term)
      if (!VALID_TABS.has(p.get("tab") || "")) p.set("tab", "posts")
      p.delete("page")
    })
  }

  function handleTabChange(tab: string) {
    if (!VALID_TABS.has(tab) || tab === activeTab) return
    pushParams((p) => {
      p.set("tab", tab)
      p.delete("page")
    })
  }

  function handleFilterChange(key: string, value: string) {
    pushParams((p) => {
      if (key === "type" && (value === "all" || value === "")) p.delete("type")
      else if (!value) p.delete(key)
      else p.set(key, value)
      p.delete("page")
    })
  }

  function handleClearFilters() {
    pushParams((p) => {
      p.delete("type")
      p.delete("hashtag")
      p.delete("dateFrom")
      p.delete("dateTo")
      p.set("sortBy", "relevance")
      p.delete("page")
    })
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
      const data = await res.json()
      setFollowed((p) => ({ ...p, [targetUserId]: !!data.following }))
    } catch {
      setFollowed((p) => ({ ...p, [targetUserId]: prev }))
    } finally {
      setFollowBusy((p) => ({ ...p, [targetUserId]: false }))
    }
  }

  const buildParams = useCallback(
    (tab: string, page: number, limit: number) => {
      const params = new URLSearchParams()
      params.set("q", qTrim)
      params.set("tab", tab)
      params.set("page", page.toString())
      params.set("limit", limit.toString())
      params.set("sortBy", sortBy)
      if (campus) params.set("campus", campus)
      if (typeFilter !== "all") params.set("type", typeFilter)
      if (hashtagFilter) params.set("hashtag", hashtagFilter)
      if (dateFrom) params.set("dateFrom", dateFrom)
      if (dateTo) params.set("dateTo", dateTo)
      return params
    },
    [qTrim, sortBy, campus, typeFilter, hashtagFilter, dateFrom, dateTo]
  )

  const fetchMainPage = useCallback(
    async (page: number, append: boolean) => {
      if (!qTrim) return
      const seq = ++fetchSeq.current
      const isTop = activeTab === "top"
      const isPostsLike = activeTab === "posts" || activeTab === "media"

      if (!append) {
        setLoading(true)
        setFetchError(null)
      } else {
        setLoadingMore(true)
      }

      try {
        if (isTop) {
          const [postsRes, peopleRes, tagsRes] = await Promise.all([
            fetch(`/api/search?${buildParams("posts", 1, 6).toString()}`),
            fetch(`/api/search?${buildParams("people", 1, COUNT_LIMIT).toString()}`),
            fetch(`/api/search?${buildParams("hashtags", 1, COUNT_LIMIT).toString()}`),
          ])
          if (seq !== fetchSeq.current) return
          if (!postsRes.ok || !peopleRes.ok || !tagsRes.ok) throw new Error("Search failed")
          const [postsData, peopleData, tagsData] = await Promise.all([
            postsRes.json(),
            peopleRes.json(),
            tagsRes.json(),
          ])
          if (seq !== fetchSeq.current) return
          setTopPosts(postsData.posts || [])
          setTopUsers((peopleData.users || []).slice(0, 3))
          setTopHashtags((tagsData.hashtags || []).slice(0, 6))
          setTabCounts({
            posts: typeof postsData.total === "number" ? postsData.total : null,
            people: Array.isArray(peopleData.users) ? peopleData.users.length : 0,
            hashtags: Array.isArray(tagsData.hashtags) ? tagsData.hashtags.length : 0,
            media: (postsData.posts || []).filter((p: Post) => p.imageUrl).length,
          })
          setNextCursor(null)
        } else if (isPostsLike) {
          const mainPromise = fetch(`/api/search?${buildParams("posts", page, PAGE_LIMIT).toString()}`)
          const countsPromise =
            !append && page === 1
              ? Promise.all([
                  fetch(`/api/search?${buildParams("people", 1, COUNT_LIMIT).toString()}`),
                  fetch(`/api/search?${buildParams("hashtags", 1, COUNT_LIMIT).toString()}`),
                ])
              : null
          const mainRes = await mainPromise
          if (seq !== fetchSeq.current) return
          if (!mainRes.ok) throw new Error("Search failed")
          const data = await mainRes.json()
          if (seq !== fetchSeq.current) return
          const incoming: Post[] = data.posts || []
          if (append) {
            setResults((prev) => ({
              ...data,
              posts: [...prev.posts, ...incoming],
            }))
          } else {
            setResults(data)
          }
          setNextCursor(incoming.length === PAGE_LIMIT ? incoming[incoming.length - 1]?.id ?? null : null)
          if (!append && page === 1) {
            setTabCounts((prev) => ({
              ...prev,
              posts: typeof data.total === "number" ? data.total : prev.posts,
              media:
                activeTab === "media"
                  ? incoming.filter((p) => p.imageUrl).length
                  : incoming.filter((p) => p.imageUrl).length,
            }))
          } else if (activeTab === "media") {
            setTabCounts((prev) => ({
              ...prev,
              media: (prev.media ?? 0) + incoming.filter((p) => p.imageUrl).length,
            }))
          }
          if (countsPromise) {
            const [peopleRes, tagsRes] = await countsPromise
            if (seq !== fetchSeq.current) return
            if (peopleRes.ok && tagsRes.ok) {
              const [peopleData, tagsData] = await Promise.all([peopleRes.json(), tagsRes.json()])
              if (seq !== fetchSeq.current) return
              setTabCounts((prev) => ({
                ...prev,
                people: Array.isArray(peopleData.users) ? peopleData.users.length : prev.people,
                hashtags: Array.isArray(tagsData.hashtags) ? tagsData.hashtags.length : prev.hashtags,
              }))
            }
          }
        } else if (activeTab === "people") {
          const [mainRes, postsRes, tagsRes] = await Promise.all([
            fetch(`/api/search?${buildParams("people", 1, COUNT_LIMIT).toString()}`),
            fetch(`/api/search?${buildParams("posts", 1, 1).toString()}`),
            fetch(`/api/search?${buildParams("hashtags", 1, COUNT_LIMIT).toString()}`),
          ])
          if (seq !== fetchSeq.current) return
          if (!mainRes.ok) throw new Error("Search failed")
          const [data, postsData, tagsData] = await Promise.all([
            mainRes.json(),
            postsRes.ok ? postsRes.json() : Promise.resolve(null),
            tagsRes.ok ? tagsRes.json() : Promise.resolve(null),
          ])
          if (seq !== fetchSeq.current) return
          setResults({ posts: [], total: data.total ?? (data.users || []).length, page: 1, totalPages: 0, users: data.users || [] })
          setTabCounts((prev) => ({
            ...prev,
            people: (data.users || []).length,
            posts: postsData && typeof postsData.total === "number" ? postsData.total : prev.posts,
            hashtags: tagsData && Array.isArray(tagsData.hashtags) ? tagsData.hashtags.length : prev.hashtags,
          }))
          setNextCursor(null)
        } else {
          const [mainRes, postsRes, peopleRes] = await Promise.all([
            fetch(`/api/search?${buildParams("hashtags", 1, COUNT_LIMIT).toString()}`),
            fetch(`/api/search?${buildParams("posts", 1, 1).toString()}`),
            fetch(`/api/search?${buildParams("people", 1, COUNT_LIMIT).toString()}`),
          ])
          if (seq !== fetchSeq.current) return
          if (!mainRes.ok) throw new Error("Search failed")
          const [data, postsData, peopleData] = await Promise.all([
            mainRes.json(),
            postsRes.ok ? postsRes.json() : Promise.resolve(null),
            peopleRes.ok ? peopleRes.json() : Promise.resolve(null),
          ])
          if (seq !== fetchSeq.current) return
          setResults({
            posts: [],
            total: data.total ?? (data.hashtags || []).length,
            page: 1,
            totalPages: 0,
            hashtags: data.hashtags || [],
          })
          setTabCounts((prev) => ({
            ...prev,
            hashtags: (data.hashtags || []).length,
            posts: postsData && typeof postsData.total === "number" ? postsData.total : prev.posts,
            people: peopleData && Array.isArray(peopleData.users) ? peopleData.users.length : prev.people,
          }))
          setNextCursor(null)
        }
      } catch (err) {
        console.error(err)
        if (seq !== fetchSeq.current) return
        if (!append) {
          setFetchError("Search failed. Check your connection and try again.")
          setResults({ posts: [], total: 0, page: 1, totalPages: 0 })
          setTopPosts([])
          setTopUsers([])
          setTopHashtags([])
        }
      } finally {
        if (seq === fetchSeq.current) {
          setLoading(false)
          setLoadingMore(false)
        }
      }
    },
    [qTrim, activeTab, buildParams]
  )

  useEffect(() => {
    if (!hasQuery) {
      // Invalidate any in-flight search so stale results can't overwrite Explore default.
      fetchSeq.current += 1
      return
    }
    const t = setTimeout(() => {
      fetchMainPage(1, false)
    }, 300)
    return () => clearTimeout(t)
  }, [hasQuery, fetchMainPage])

  useEffect(() => {
    if (hasQuery) return
    let cancelled = false
    fetch(`/api/trending?window=24h&limit=10`)
      .then((res) => (res.ok ? res.json() : null))
      .then((data) => {
        if (!cancelled && data) setExploreData(data)
      })
      .catch(() => {})
      .finally(() => {
        if (!cancelled) setExploreLoading(false)
      })
    return () => {
      cancelled = true
    }
  }, [hasQuery])

  const handleLoadMore = useCallback(() => {
    if (loadingMore || loading || !nextCursor) return
    if (activeTab !== "posts" && activeTab !== "media") return
    fetchMainPage(results.page + 1, true)
  }, [loadingMore, loading, nextCursor, activeTab, fetchMainPage, results.page])

  useEffect(() => {
    const el = sentinelRef.current
    if (!el || !hasQuery || !nextCursor || loading || loadingMore) return
    if (activeTab !== "posts" && activeTab !== "media") return
    const obs = new IntersectionObserver(
      (entries) => {
        if (entries[0].isIntersecting) handleLoadMore()
      },
      { rootMargin: "400px" }
    )
    obs.observe(el)
    return () => obs.disconnect()
  }, [hasQuery, nextCursor, loading, loadingMore, activeTab, results.page, handleLoadMore])

  const posts = results.posts || []
  const users = results.users || []
  const hashtags = results.hashtags || []
  const mediaPosts = posts.filter((p) => p.imageUrl)
  const showPostFilters = activeTab === "posts" || activeTab === "media" || activeTab === "top"

  function countBadge(key: TabKey): string | null {
    if (key === "top") return null
    if (key === "posts") return formatBadge(tabCounts.posts, false)
    if (key === "people") return formatBadge(tabCounts.people, true)
    if (key === "hashtags") return formatBadge(tabCounts.hashtags, true)
    return formatBadge(tabCounts.media, false)
  }

  function renderUserRow(user: User) {
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
            {user._count.followers} follower{user._count.followers !== 1 ? "s" : ""} · {user._count.posts} post
            {user._count.posts !== 1 ? "s" : ""}
          </p>
        </Link>
        <button
          type="button"
          onClick={() => toggleFollow(user.id)}
          disabled={busy}
          aria-pressed={isFollowing}
          className={`flex-shrink-0 text-xs px-3 py-1.5 rounded-full border font-semibold transition-all focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#baff39] disabled:opacity-50 ${
            isFollowing
              ? "bg-[#baff39]/15 text-[#baff39] border-[#baff39]/30"
              : "text-white/70 border-white/20 hover:text-[#baff39] hover:border-[#baff39]/50"
          }`}
        >
          {isFollowing ? "Following" : "Follow"}
        </button>
      </div>
    )
  }

  return (
    <main className="min-h-screen max-w-lg mx-auto pb-28 px-4 py-4">
      <SearchBar
        key={urlQ}
        initialQuery={urlQ}
        onSearch={handleSearch}
        campus={campus}
        placeholder="Search posts, ghosts, hashtags..."
        className="mb-4"
      />

      <div
        role="tablist"
        aria-label="Search results tabs"
        className="sticky top-0 bg-black/80 backdrop-blur border-b border-white/10 z-10 mb-4 rounded-xl p-1 flex gap-1 overflow-x-auto"
      >
        {TABS.map((tab) => {
          const badge = countBadge(tab.key)
          const selected = activeTab === tab.key
          return (
            <button
              key={tab.key}
              role="tab"
              id={`tab-${tab.key}`}
              aria-selected={selected}
              aria-controls={`panel-${tab.key}`}
              onClick={() => handleTabChange(tab.key)}
              className={`flex-1 whitespace-nowrap flex items-center justify-center gap-1.5 py-2 px-3 rounded-lg text-sm font-medium transition-all focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#baff39] ${
                selected
                  ? "bg-[#baff39]/15 text-[#baff39]"
                  : "text-white/50 hover:text-white/80 hover:bg-white/5"
              }`}
            >
              <span aria-hidden="true">{tab.icon}</span>
              <span>{tab.label}</span>
              {badge && (
                <span
                  className={`text-[11px] px-1.5 py-0.5 rounded-full ${
                    selected ? "bg-[#baff39]/20 text-[#baff39]" : "bg-white/10 text-white/50"
                  }`}
                >
                  {badge}
                </span>
              )}
            </button>
          )
        })}
      </div>

      {!hasQuery ? (
        <div>
          {recents.length > 0 && (
            <section aria-labelledby="recent-heading" className="mb-6">
              <div className="flex items-center justify-between px-1 mb-2">
                <h2 id="recent-heading" className="text-sm font-semibold text-white/80">
                  Recent searches
                </h2>
                <button
                  type="button"
                  onClick={clearRecents}
                  className="text-xs text-white/40 hover:text-[#baff39] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#baff39] rounded"
                >
                  Clear all
                </button>
              </div>
              <ul className="divide-y divide-white/[0.06] border-y border-white/[0.06]">
                {recents.map((term) => (
                  <li key={term} className="flex items-center gap-1 px-2">
                    <button
                      type="button"
                      onClick={() => handleRecentRerun(term)}
                      className="flex-1 flex items-center gap-3 py-2.5 text-left text-white/85 hover:text-[#baff39] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#baff39] rounded"
                    >
                      <span aria-hidden="true" className="text-white/30">
                        🕘
                      </span>
                      <span className="truncate text-sm">{term}</span>
                    </button>
                    <button
                      type="button"
                      onClick={() => removeRecent(term)}
                      aria-label={`Remove ${term} from recent searches`}
                      className="p-2 text-white/30 hover:text-white/80 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#baff39] rounded"
                    >
                      ✕
                    </button>
                  </li>
                ))}
              </ul>
            </section>
          )}

          {exploreLoading && !exploreData ? (
            <SkeletonList rows={4} />
          ) : (
            <>
              <section aria-labelledby="explore-tags-heading" className="mb-6">
                <div className="flex items-center justify-between px-1 mb-2">
                  <h2 id="explore-tags-heading" className="text-sm font-semibold text-white/80">
                    Trending hashtags
                  </h2>
                  <Link
                    href="/explore"
                    className="text-xs text-white/40 hover:text-[#baff39] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#baff39] rounded"
                  >
                    Explore →
                  </Link>
                </div>
                {!exploreData || exploreData.hashtags.length === 0 ? (
                  <p className="text-white/40 text-sm px-1">No trending hashtags yet.</p>
                ) : (
                  <div className="grid grid-cols-2 gap-3 px-1">
                    {exploreData.hashtags.slice(0, 6).map((ht, index) => (
                      <Link
                        key={ht.id}
                        href={`/search?q=%23${encodeURIComponent(ht.tag)}&tab=posts`}
                        className="bg-white/5 border border-white/10 rounded-xl p-4 hover:border-[#baff39]/30 hover:bg-white/10 transition-all group focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#baff39]"
                      >
                        <div className="flex items-center justify-between mb-2">
                          <span className="text-sm font-bold text-white/90 group-hover:text-[#baff39] transition-colors truncate">
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

              <section aria-labelledby="explore-ghosts-heading" className="mb-6">
                <h2 id="explore-ghosts-heading" className="text-sm font-semibold text-white/80 px-1 mb-2">
                  Suggested ghosts
                </h2>
                {!exploreData || exploreData.suggestedGhosts.length === 0 ? (
                  <p className="text-white/40 text-sm px-1">No suggestions right now.</p>
                ) : (
                  <div className="border-y border-white/[0.06] divide-y divide-white/[0.06]">
                    {exploreData.suggestedGhosts.slice(0, 4).map((user) => renderUserRow(user))}
                  </div>
                )}
              </section>

              <section aria-labelledby="explore-posts-heading">
                <div className="flex items-center justify-between px-1 mb-2">
                  <h2 id="explore-posts-heading" className="text-sm font-semibold text-white/80">
                    Trending posts
                  </h2>
                  <Link
                    href="/explore"
                    className="text-xs text-white/40 hover:text-[#baff39] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#baff39] rounded"
                  >
                    See more →
                  </Link>
                </div>
                {!exploreData || exploreData.posts.length === 0 ? (
                  <div className="text-center mt-8 px-8">
                    <p className="text-3xl mb-3">📈</p>
                    <p className="text-white/50 text-sm">Nothing trending yet. Try searching for something.</p>
                  </div>
                ) : (
                  <div className="border-t border-white/[0.06]">
                    {exploreData.posts.slice(0, 4).map((post) => (
                      <PostCard key={post.id} post={post} />
                    ))}
                  </div>
                )}
              </section>
            </>
          )}
        </div>
      ) : (
        <div>
          {showPostFilters && (
            <div className="mb-3 space-y-2">
              <div className="flex items-center justify-between text-sm text-white/50 px-1">
                <span>
                  {activeTab === "top"
                    ? `Top results for “${qTrim}”`
                    : `${activeTab === "media" ? mediaPosts.length : results.total} result${
                        (activeTab === "media" ? mediaPosts.length : results.total) !== 1 ? "s" : ""
                      }`}
                </span>
                <select
                  value={sortBy}
                  onChange={(e) => handleFilterChange("sortBy", e.target.value)}
                  aria-label="Sort results"
                  className="bg-white/5 border border-white/10 rounded-lg px-3 py-1 text-white text-xs focus:outline-none focus:border-[#baff39]/50"
                >
                  <option value="relevance">{SORT_LABELS.relevance}</option>
                  <option value="recent">{SORT_LABELS.recent}</option>
                  <option value="engagement">{SORT_LABELS.engagement}</option>
                </select>
              </div>
              <div className="flex gap-1.5 px-1 overflow-x-auto" role="group" aria-label="Filter by post type">
                {TYPE_CHIPS.map((chip) => {
                  const selected = typeFilter === chip.key
                  return (
                    <button
                      key={chip.key}
                      type="button"
                      onClick={() => handleFilterChange("type", chip.key)}
                      aria-pressed={selected}
                      className={`whitespace-nowrap text-xs px-3 py-1.5 rounded-full border font-medium transition-all focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#baff39] ${
                        selected
                          ? "bg-[#baff39]/15 text-[#baff39] border-[#baff39]/30"
                          : "bg-white/5 text-white/50 border-white/10 hover:text-white/80"
                      }`}
                    >
                      {chip.label}
                    </button>
                  )
                })}
              </div>
              {(hashtagFilter || dateFrom || dateTo) && (
                <p className="text-xs text-white/40 px-1">
                  Active filters:{hashtagFilter ? ` #${hashtagFilter}` : ""}
                  {dateFrom || dateTo ? " · date range" : ""} ·{" "}
                  <button
                    type="button"
                    onClick={handleClearFilters}
                    className="text-[#baff39]/80 hover:text-[#baff39] underline underline-offset-2 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#baff39] rounded"
                  >
                    clear
                  </button>
                </p>
              )}
            </div>
          )}

          {loading ? (
            <SkeletonList rows={5} />
          ) : fetchError ? (
            <div className="text-center mt-14 px-8">
              <p className="text-3xl mb-3">😵</p>
              <p className="text-white/50 text-sm mb-4">{fetchError}</p>
              <button
                type="button"
                onClick={() => fetchMainPage(1, false)}
                className="btn-ghost text-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#baff39]"
              >
                Retry
              </button>
            </div>
          ) : (
            <>
              {activeTab === "top" && (
                <div role="tabpanel" id="panel-top" aria-labelledby="tab-top">
                  {topPosts.length === 0 && topUsers.length === 0 && topHashtags.length === 0 ? (
                    <div className="text-center mt-14 px-8">
                      <p className="text-3xl mb-3">🔍</p>
                      <p className="text-white/50 text-sm mb-4">No top results for &quot;{qTrim}&quot;</p>
                      <button
                        type="button"
                        onClick={handleClearFilters}
                        className="btn-ghost text-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#baff39]"
                      >
                        Clear filters
                      </button>
                    </div>
                  ) : (
                    <>
                      {topUsers.length > 0 && (
                        <section aria-label="Top ghosts" className="mb-4">
                          <div className="flex items-center justify-between px-1 mb-1">
                            <h3 className="text-sm font-semibold text-white/80">Ghosts</h3>
                            <button
                              type="button"
                              onClick={() => handleTabChange("people")}
                              className="text-xs text-white/40 hover:text-[#baff39] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#baff39] rounded"
                            >
                              See all →
                            </button>
                          </div>
                          <div className="border-y border-white/[0.06] divide-y divide-white/[0.06]">
                            {topUsers.map((u) => renderUserRow(u))}
                          </div>
                        </section>
                      )}
                      {topHashtags.length > 0 && (
                        <section aria-label="Top hashtags" className="mb-4">
                          <div className="flex items-center justify-between px-1 mb-1">
                            <h3 className="text-sm font-semibold text-white/80">Hashtags</h3>
                            <button
                              type="button"
                              onClick={() => handleTabChange("hashtags")}
                              className="text-xs text-white/40 hover:text-[#baff39] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#baff39] rounded"
                            >
                              See all →
                            </button>
                          </div>
                          <div className="flex flex-wrap gap-1.5 px-1">
                            {topHashtags.map((ht) => (
                              <Link
                                key={ht.id}
                                href={`/search?q=%23${encodeURIComponent(ht.tag)}&tab=posts`}
                                className="text-xs bg-white/5 border border-white/10 rounded-full px-3 py-1.5 text-[#baff39]/80 hover:text-[#baff39] hover:border-[#baff39]/30 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#baff39]"
                              >
                                #{ht.tag} · {ht.postsCount}
                              </Link>
                            ))}
                          </div>
                        </section>
                      )}
                      <section aria-label="Top posts">
                        <div className="flex items-center justify-between px-1 mb-1">
                          <h3 className="text-sm font-semibold text-white/80">Posts</h3>
                          <button
                            type="button"
                            onClick={() => handleTabChange("posts")}
                            className="text-xs text-white/40 hover:text-[#baff39] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#baff39] rounded"
                          >
                            See all →
                          </button>
                        </div>
                        <div className="border-t border-white/[0.06]">
                          {topPosts.slice(0, 5).map((post) => (
                            <PostCard key={post.id} post={post} />
                          ))}
                        </div>
                      </section>
                    </>
                  )}
                </div>
              )}

              {activeTab === "posts" && (
                <div role="tabpanel" id="panel-posts" aria-labelledby="tab-posts">
                  {posts.length === 0 ? (
                    <div className="text-center mt-14 px-8">
                      <p className="text-3xl mb-3">🔍</p>
                      <p className="text-white/50 text-sm mb-4">No posts found for &quot;{qTrim}&quot;</p>
                      <button
                        type="button"
                        onClick={handleClearFilters}
                        className="btn-ghost text-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#baff39]"
                      >
                        Clear filters
                      </button>
                    </div>
                  ) : (
                    <div className="border-t border-white/[0.06]">
                      {posts.map((post) => (
                        <PostCard key={post.id} post={post} />
                      ))}
                      <div ref={sentinelRef} aria-hidden="true" className="h-1" />
                      {loadingMore && (
                        <div className="animate-pulse bg-white/5 rounded-xl p-4 border border-white/10 my-3" aria-busy="true">
                          <div className="h-4 w-2/3 bg-white/10 rounded" />
                        </div>
                      )}
                      {!loadingMore && nextCursor && (
                        <button
                          onClick={handleLoadMore}
                          className="w-full py-3 text-white/50 hover:text-white/80 text-sm font-medium border-t border-white/10 mt-2 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#baff39] rounded"
                        >
                          Load more
                        </button>
                      )}
                    </div>
                  )}
                </div>
              )}

              {activeTab === "media" && (
                <div role="tabpanel" id="panel-media" aria-labelledby="tab-media">
                  {mediaPosts.length === 0 ? (
                    <div className="text-center mt-14 px-8">
                      <p className="text-3xl mb-3">🖼️</p>
                      <p className="text-white/50 text-sm mb-4">No media found for &quot;{qTrim}&quot;</p>
                      <button
                        type="button"
                        onClick={handleClearFilters}
                        className="btn-ghost text-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#baff39]"
                      >
                        Clear filters
                      </button>
                    </div>
                  ) : (
                    <div>
                      <div className="grid grid-cols-3 gap-1">
                        {mediaPosts.map((post) => (
                          <Link
                            key={post.id}
                            href={`/post/${post.id}`}
                            aria-label={`Open media post by ${post.user.ghostId}`}
                            className="relative aspect-square rounded-lg overflow-hidden bg-white/5 border border-white/10 hover:border-[#baff39]/30 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#baff39]"
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
                      <div ref={sentinelRef} aria-hidden="true" className="h-1" />
                      {loadingMore && <p className="text-center text-white/30 text-sm py-4">Loading more...</p>}
                      {!loadingMore && nextCursor && (
                        <button
                          onClick={handleLoadMore}
                          className="w-full py-3 text-white/50 hover:text-white/80 text-sm font-medium border-t border-white/10 mt-2 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#baff39] rounded"
                        >
                          Load more
                        </button>
                      )}
                    </div>
                  )}
                </div>
              )}

              {activeTab === "people" && (
                <div role="tabpanel" id="panel-people" aria-labelledby="tab-people">
                  {users.length === 0 ? (
                    <div className="text-center mt-14 px-8">
                      <p className="text-3xl mb-3">👻</p>
                      <p className="text-white/50 text-sm mb-4">No ghosts found for &quot;{qTrim}&quot;</p>
                      <button
                        type="button"
                        onClick={handleClearFilters}
                        className="btn-ghost text-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#baff39]"
                      >
                        Clear filters
                      </button>
                    </div>
                  ) : (
                    <div className="border-t border-white/[0.06] divide-y divide-white/[0.06]">
                      {users.map((user) => renderUserRow(user))}
                    </div>
                  )}
                </div>
              )}

              {activeTab === "hashtags" && (
                <div role="tabpanel" id="panel-hashtags" aria-labelledby="tab-hashtags">
                  {hashtags.length === 0 ? (
                    <div className="text-center mt-14 px-8">
                      <p className="text-3xl mb-3">#</p>
                      <p className="text-white/50 text-sm mb-4">No hashtags found for &quot;{qTrim}&quot;</p>
                      <button
                        type="button"
                        onClick={handleClearFilters}
                        className="btn-ghost text-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#baff39]"
                      >
                        Clear filters
                      </button>
                    </div>
                  ) : (
                    <div className="border-t border-white/[0.06]">
                      {hashtags.map((ht) => (
                        <Link
                          key={ht.id}
                          href={`/search?q=%23${encodeURIComponent(ht.tag)}&tab=posts`}
                          className="block px-4 py-3 border-b border-white/[0.06] hover:bg-white/[0.02] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-[#baff39]"
                        >
                          <div className="flex items-center justify-between">
                            <div className="flex items-center gap-3">
                              <span className="text-2xl" aria-hidden="true">
                                #
                              </span>
                              <div>
                                <p className="font-semibold text-white/90">#{ht.tag}</p>
                                <p className="text-white/40 text-sm">
                                  {ht.postsCount} post{ht.postsCount !== 1 ? "s" : ""}
                                </p>
                              </div>
                            </div>
                            <span className="text-xs text-white/30 bg-white/5 px-2 py-1 rounded">
                              Trending: {ht.trendingScore.toFixed(1)}
                            </span>
                          </div>
                        </Link>
                      ))}
                    </div>
                  )}
                </div>
              )}
            </>
          )}
        </div>
      )}
    </main>
  )
}

export default function SearchPage() {
  return (
    <Suspense
      fallback={
        <main className="min-h-screen max-w-lg mx-auto pb-28 px-4 py-6 flex items-center justify-center">
          <div className="animate-spin rounded-full h-8 w-8 border-2 border-[#baff39] border-t-transparent" />
        </main>
      }
    >
      <SearchPageContent />
    </Suspense>
  )
}
