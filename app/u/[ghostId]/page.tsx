"use client"

import { useEffect, useRef, useState } from "react"
import { useParams, useRouter } from "next/navigation"
import Link from "next/link"
import { apiGet, apiPost } from "@/lib/useApi"
import { timeAgo } from "@/lib/timeAgo"

type Post = {
  id: string
  text: string | null
  imageUrl: string | null
  yeahs: number
  commentsCount: number
  createdAt: string
}

type Profile = {
  id: string
  ghostId: string
  avatarEmoji: string
  campus: string
  tier: string
  streakCount: number
  postCount: number
  followersCount: number
  followingCount: number
  score: number
  isFollowing: boolean
  isOwn: boolean
}

export default function ProfilePage() {
  const params = useParams<{ ghostId: string }>()
  return <GhostProfile key={params.ghostId} ghostId={params.ghostId} />
}

function GhostProfile({ ghostId }: { ghostId: string }) {
  const router = useRouter()
  const [profile, setProfile] = useState<Profile | null>(null)
  const [posts, setPosts] = useState<Post[]>([])
  const [loading, setLoading] = useState(true)
  const [notFound, setNotFound] = useState(false)
  const [followPending, setFollowPending] = useState(false)
  const [error, setError] = useState("")
  const [nextCursor, setNextCursor] = useState<string | null>(null)
  const [loadingMore, setLoadingMore] = useState(false)
  const followRequest = useRef(false)
  const moreRequest = useRef(false)

  useEffect(() => {
    let active = true
    apiGet(`/api/users/${encodeURIComponent(ghostId)}`)
      .then((data) => {
        if (!active) return
        setProfile(data.user)
        setPosts(data.posts)
        setNextCursor(data.nextCursor)
      })
      .catch((err: unknown) => {
        if (!active) return
        const message = err instanceof Error ? err.message : "Could not load profile."
        if (message === "Not authenticated.") router.push("/login")
        else if (message === "Ghost not found.") setNotFound(true)
        else setError(message)
      })
      .finally(() => {
        if (active) setLoading(false)
      })
    return () => { active = false }
  }, [ghostId, router])

  async function loadMore() {
    if (!nextCursor || moreRequest.current) return
    moreRequest.current = true
    setLoadingMore(true)
    setError("")
    try {
      const data = await apiGet(`/api/users/${encodeURIComponent(ghostId)}?cursor=${encodeURIComponent(nextCursor)}`)
      setPosts((prev) => [...prev, ...data.posts])
      setNextCursor(data.nextCursor)
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : "Could not load more posts.")
    } finally {
      moreRequest.current = false
      setLoadingMore(false)
    }
  }

  async function handleFollow() {
    if (!profile || profile.isOwn || followRequest.current) return
    followRequest.current = true
    setFollowPending(true)
    try {
      const data = await apiPost("/api/follow", { targetUserId: profile.id })
      setProfile((prev) => (prev ? {
        ...prev,
        isFollowing: data.following,
        followersCount: Math.max(0, prev.followersCount + Number(data.following) - Number(prev.isFollowing)),
      } : prev))
    } catch (err: unknown) {
      alert(err instanceof Error ? err.message : "Something went wrong.")
    } finally {
      followRequest.current = false
      setFollowPending(false)
    }
  }

  if (loading) return <p className="text-center text-white/40 mt-10">Summoning ghost...</p>
  if (error && !profile) return <div className="text-center mt-10 px-4"><p role="alert" className="text-white/60">{error}</p><button onClick={() => window.location.reload()} className="btn-ghost mt-3">Try again</button></div>
  if (notFound || !profile) return <div className="text-center text-white/40 mt-10"><p>Ghost not found.</p><Link href="/feed" className="text-[#baff39]">Back to feed</Link></div>

  return (
    <main className="min-h-screen max-w-lg mx-auto pb-28 px-4 relative overflow-hidden">
      <div className="flex items-center gap-3 pt-5 pb-3">
        <button onClick={() => router.back()} className="text-white/60" aria-label="Go back">←</button>
        <h1 className="text-lg font-bold">Ghost Profile</h1>
      </div>

      <div className="flex flex-col items-center mt-2 mb-4 relative">
        <div
          className="avatar-circle text-4xl w-24 h-24 mb-3"
          style={{ boxShadow: "0 0 40px rgba(186,255,57,0.2)" }}
        >
          {profile.avatarEmoji}
        </div>
        <h1 className="text-xl font-bold">{profile.ghostId}</h1>
        <div className="flex items-center gap-2 mt-1">
          <span className="text-white/40 text-sm">{profile.campus}</span>
          {profile.tier !== "FREE" && <span className="badge badge-prime">{profile.tier}</span>}
        </div>

        {profile.isOwn ? <Link href="/lair" className="btn-ghost mt-3 text-sm">My private Lair</Link> : <button
          onClick={handleFollow}
          disabled={followPending}
          aria-pressed={profile.isFollowing}
          className={`mt-3 px-5 py-2 rounded-full text-sm font-semibold border disabled:opacity-50 ${
            profile.isFollowing
              ? "border-[#baff39] text-[#baff39] bg-[#baff39]/10"
              : "border-white/20 text-white hover:border-[#baff39] hover:text-[#baff39]"
          }`}
        >
          {profile.isFollowing ? "✓ Following" : "Follow"}
        </button>}

        <div className="flex gap-6 mt-4 text-sm">
          <div className="text-center">
            <span className="font-bold block">{profile.followingCount}</span>
            <span className="text-white/40 text-xs">Following</span>
          </div>
          <div className="text-center">
            <span className="font-bold block">{profile.followersCount}</span>
            <span className="text-white/40 text-xs">Followers</span>
          </div>
        </div>
      </div>

      <div className="grid grid-cols-3 gap-2 mb-5">
        <div className="card p-3 text-center">
          <p className="text-lg font-bold">🔥 {profile.streakCount}</p>
          <p className="text-xs text-white/40">Streak</p>
        </div>
        <div className="card p-3 text-center">
          <p className="text-lg font-bold">{profile.postCount}</p>
          <p className="text-xs text-white/40">Posts</p>
        </div>
        <div className="card p-3 text-center">
          <p className="text-lg font-bold">{profile.score}</p>
          <p className="text-xs text-white/40">Points</p>
        </div>
      </div>

      <h3 className="text-sm font-semibold text-white/60 mb-2">Posts</h3>
      {posts.length === 0 ? (
        <p className="text-white/30 text-sm">This ghost hasn&apos;t posted yet.</p>
      ) : (
        posts.map((p) => (
          <Link
            key={p.id}
            href={`/post/${p.id}`}
            aria-label={`Open post by ${profile.ghostId}`}
            className="block border-b border-white/[0.06] py-3 hover:bg-white/[0.02] focus-visible:outline-[#baff39]"
          >
            <div className="flex items-center gap-2 text-sm mb-1">
              <span className="font-semibold">{profile.ghostId}</span>
              <span className="text-white/30">· {timeAgo(p.createdAt)}</span>
            </div>
            {p.text && <p className="text-white/90 text-sm">{p.text}</p>}
            {p.imageUrl && <img src={p.imageUrl} className="rounded-lg mt-2 w-full max-h-72 object-cover" alt="" />}
            <div className="flex gap-4 text-xs text-white/40 mt-1">
              <span>🔥 {p.yeahs}</span>
              <span>💬 {p.commentsCount}</span>
            </div>
          </Link>
        ))
      )}
      {error && <p role="alert" className="text-sm text-white/60 mt-3">{error}</p>}
      {nextCursor && <button onClick={loadMore} disabled={loadingMore} className="btn-ghost w-full mt-4 disabled:opacity-50">{loadingMore ? "Loading..." : "Load more posts"}</button>}
    </main>
  )
}
