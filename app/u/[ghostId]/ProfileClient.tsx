"use client"

import { useEffect, useRef, useState } from "react"
import { useRouter } from "next/navigation"
import Link from "next/link"
import { apiGet, apiPost } from "@/lib/useApi"
import { timeAgo } from "@/lib/timeAgo"
import { shareContent, getShareTargets } from "@/lib/share"
import OptimizedImage from "@/app/components/OptimizedImage"
import Avatar from "@/app/components/Avatar"
import ChampionTrophies from "@/app/components/ChampionTrophies"
import SmartNudge from "@/app/components/SmartNudge"

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
  championTrophies?: number
}

export default function ProfileClient({ ghostId }: { ghostId: string }) {
  const router = useRouter()
  const [profile, setProfile] = useState<Profile | null>(null)
  const [posts, setPosts] = useState<Post[]>([])
  const [loading, setLoading] = useState(true)
  const [notFound, setNotFound] = useState(false)
  const [followPending, setFollowPending] = useState(false)
  const [error, setError] = useState("")
  const [nextCursor, setNextCursor] = useState<string | null>(null)
  const [loadingMore, setLoadingMore] = useState(false)
  const [showShareMenu, setShowShareMenu] = useState(false)
  const [showQRCode, setShowQRCode] = useState(false)
  const [qrCodeUrl, setQrCodeUrl] = useState<string | null>(null)
  const followRequest = useRef(false)
  const moreRequest = useRef(false)

  async function loadQRCode() {
    try {
      const res = await fetch(`/api/qr/profile/${ghostId}`)
      if (res.ok) {
        const data = await res.json()
        setQrCodeUrl(data.qrCode)
      }
    } catch (err) {
      console.error("Failed to load QR code:", err)
    }
  }

  useEffect(() => {
    let active = true
    apiGet<{ user: Profile; posts: Post[]; nextCursor: string | null }>(`/api/users/${encodeURIComponent(ghostId)}`)
      .then((data) => {
        if (!active) return
        setProfile(data.user)
        setPosts(data.posts)
        setNextCursor(data.nextCursor)
      })
      .catch((err: unknown) => {
        if (!active) return
        const message = err instanceof Error ? err.message : "could not load profile."
        if (message === "not authenticated.") router.push("/login")
        else if (message === "ghost not found.") setNotFound(true)
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
      const data = await apiGet<{ posts: Post[]; nextCursor: string | null }>(`/api/users/${encodeURIComponent(ghostId)}?cursor=${encodeURIComponent(nextCursor)}`)
      setPosts((prev) => [...prev, ...data.posts])
      setNextCursor(data.nextCursor)
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : "could not load more posts.")
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
      const data = await apiPost<{ following: boolean }>("/api/follow", { targetUserId: profile.id })
      setProfile((prev) => (prev ? {
        ...prev,
        isFollowing: data.following,
        followersCount: Math.max(0, prev.followersCount + Number(data.following) - Number(prev.isFollowing)),
      } : prev))
    } catch (err: unknown) {
      alert(err instanceof Error ? err.message : "something went wrong.")
    } finally {
      followRequest.current = false
      setFollowPending(false)
    }
  }

  if (loading) return <p className="text-center text-white/40 mt-10">summoning ghost...</p>
  if (error && !profile) return <div className="text-center mt-10 px-4"><p role="alert" className="text-white/60">{error}</p><button onClick={() => window.location.reload()} className="btn-ghost mt-3">try again</button></div>
  if (notFound || !profile) return <div className="text-center text-white/40 mt-10"><p>ghost not found.</p><Link href="/feed" className="text-primary">back to feed</Link></div>

  return (
    <main className="min-h-screen max-w-lg mx-auto pb-28 px-4 relative overflow-hidden">
      <div className="flex items-center gap-3 pt-5 pb-3">
        <button onClick={() => router.back()} className="text-white/60" aria-label="go back">←</button>
        <h1 className="text-lg font-bold">ghost profile</h1>
      </div>

      {profile.isOwn && <SmartNudge compact />}

      <div className="flex flex-col items-center mt-2 mb-4 relative">
        {profile.tier === "PRIME" && (
          <div className="absolute -inset-2 rounded-full bg-gradient-to-r from-[#facc15] to-[#d4a017] opacity-30 blur-xl animate-pulse" style={{ animationDuration: "3s" }} />
        )}
        {profile.tier === "PLUS" && (
          <div className="absolute -inset-2 rounded-full bg-sky-500/20 blur-xl" />
        )}
        <div className={`relative w-24 h-24 mb-3 ${profile.tier === "PRIME" ? "ring-2 ring-[#facc15]/50" : profile.tier === "PLUS" ? "ring-2 ring-sky-500/50" : ""}`} style={{ boxShadow: "0 0 40px rgba(186,255,57,0.2)" }}>
          <Avatar emoji={profile.avatarEmoji} size={96} />
        </div>
        <h1 className="text-xl font-bold">{profile.ghostId}</h1>
        <div className="flex items-center gap-2 mt-1">
          <span className="text-white/40 text-sm">{profile.campus}</span>
          {profile.tier === "PRIME" && <span className="badge badge-prime">prime</span>}
          {profile.tier === "PLUS" && <span className="badge badge-plus">✓ plus</span>}
          <ChampionTrophies trophies={profile.championTrophies} />
        </div>

        {profile.isOwn ? (
          <>
            <Link href="/lair" className="btn-ghost mt-3 text-sm">my private lair</Link>
            <div className="flex gap-2 mt-3">
              <ProfileShareButton
                onShareClick={() => setShowShareMenu(true)}
                onQRClick={() => {
                  loadQRCode()
                  setShowQRCode(true)
                }}
              />
            </div>
          </>
        ) : (
          <button
            onClick={handleFollow}
            disabled={followPending}
            aria-pressed={profile.isFollowing}
            className={`mt-3 px-5 py-2 rounded-full text-sm font-semibold border disabled:opacity-50 ${
              profile.isFollowing
                ? "border-primary text-primary bg-primary/10"
                : "border-white/20 text-white hover:border-primary hover:text-primary"
            }`}
          >
            {profile.isFollowing ? "✓ following" : "follow"}
          </button>
        )}

        <div className="flex gap-6 mt-4 text-sm">
          <div className="text-center">
            <span className="font-bold block">{profile.followingCount}</span>
            <span className="text-white/40 text-xs">following</span>
          </div>
          <div className="text-center">
            <span className="font-bold block">{profile.followersCount}</span>
            <span className="text-white/40 text-xs">followers</span>
          </div>
        </div>
      </div>

      <div className="grid grid-cols-3 gap-2 mb-5">
        <div className="card p-3 text-center">
          <p className="text-lg font-bold">🔥 {profile.streakCount}</p>
          <p className="text-xs text-white/40">streak</p>
        </div>
        <div className="card p-3 text-center">
          <p className="text-lg font-bold">{profile.postCount}</p>
          <p className="text-xs text-white/40">posts</p>
        </div>
        <div className="card p-3 text-center">
          <p className="text-lg font-bold">{profile.score}</p>
          <p className="text-xs text-white/40">points</p>
        </div>
      </div>

      <h3 className="text-sm font-semibold text-white/60 mb-2">posts</h3>
      {posts.length === 0 ? (
        <p className="text-white/30 text-sm">this ghost hasn&apos;t posted yet.</p>
      ) : (
        posts.map((p) => (
          <Link
            key={p.id}
            href={`/post/${p.id}`}
            aria-label={`open post by ${profile.ghostId}`}
            className="block border-b border-white/[0.06] py-3 hover:bg-white/[0.02] focus-visible:outline-[#baff39]"
          >
            <div className="flex items-center gap-2 text-sm mb-1">
              <span className="font-semibold">{profile.ghostId}</span>
              <span className="text-white/30">· {timeAgo(p.createdAt)}</span>
            </div>
            {p.text && <p className="post-mono text-white/90 text-sm">{p.text}</p>}
            {p.imageUrl && (
              <div className="relative w-full max-h-72 mt-2">
                <OptimizedImage
                  src={p.imageUrl}
                  alt=""
                  fill
                  sizes="(max-width: 768px) 100vw, 50vw"
                  rounded
                />
              </div>
            )}
            <div className="flex gap-4 text-xs text-white/40 mt-1">
              <span>🔥 {p.yeahs}</span>
              <span>💬 {p.commentsCount}</span>
            </div>
          </Link>
        ))
      )}
      {error && <p role="alert" className="text-sm text-white/60 mt-3">{error}</p>}
      {nextCursor && <button onClick={loadMore} disabled={loadingMore} className="btn-ghost w-full mt-4 disabled:opacity-50">{loadingMore ? "loading..." : "load more posts"}</button>}

      {showShareMenu && <ShareMenu ghostId={profile!.ghostId} onClose={() => setShowShareMenu(false)} />}
      {showQRCode && <QRCodeModal qrCodeUrl={qrCodeUrl} onClose={() => setShowQRCode(false)} />}
    </main>
  )
}

function ProfileShareButton({
  onShareClick,
  onQRClick,
}: {
  onShareClick: () => void
  onQRClick: () => void
}) {
  return (
    <div className="flex gap-2">
      <button onClick={onShareClick} className="btn-ghost text-sm px-4" aria-label="share profile">
        🔗 share
      </button>
      <button onClick={onQRClick} className="btn-ghost text-sm px-4" aria-label="show qr code">
        📱 qr
      </button>
    </div>
  )
}

function ShareMenu({ ghostId, onClose }: { ghostId: string; onClose: () => void }) {
  const targets = getShareTargets()

  return (
    <div className="fixed inset-0 z-50 flex items-end justify-center px-4 pb-4" onClick={onClose}>
      <div className="absolute inset-0 bg-black/50" onClick={onClose} />
      <div className="relative card p-4 w-full max-w-sm shadow-xl border border-white/10 animate-slide-up">
        <div className="flex items-center justify-between mb-4">
          <h3 className="font-semibold">share profile</h3>
          <button onClick={onClose} className="text-white/50 hover:text-white" aria-label="close">✕</button>
        </div>
        <div className="grid grid-cols-2 gap-2">
          {targets.map((target) => (
            <button
              key={target}
              onClick={() => {
                shareContent({ type: "profile", id: ghostId }, target)
                onClose()
              }}
              className="px-4 py-3 text-sm text-white/90 hover:bg-white/10 rounded border border-white/10 focus-visible:outline-[#baff39]"
            >
              {target === "native" && "📤 native share"}
              {target === "whatsapp" && "💬 whatsapp"}
              {target === "twitter" && "🐦 x (twitter)"}
              {target === "copy" && "📋 copy link"}
            </button>
          ))}
        </div>
      </div>
    </div>
  )
}

function QRCodeModal({ qrCodeUrl, onClose }: { qrCodeUrl: string | null; onClose: () => void }) {
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center px-4" onClick={onClose}>
      <div className="absolute inset-0 bg-black/70" onClick={onClose} />
      <div className="relative card p-6 max-w-sm w-full shadow-xl border border-white/10 animate-scale-in">
        <div className="flex items-center justify-between mb-4">
          <h3 className="font-semibold">profile qr code</h3>
          <button onClick={onClose} className="text-white/50 hover:text-white" aria-label="close">✕</button>
        </div>
        <div className="flex flex-col items-center gap-4">
          {qrCodeUrl ? (
            <img src={qrCodeUrl} alt="profile qr code" className="w-64 h-64 rounded-lg bg-white" />
          ) : (
            <div className="w-64 h-64 flex items-center justify-center bg-white/5 rounded-lg">
              <p className="text-white/50">loading qr code...</p>
            </div>
          )}
          <p className="text-sm text-white/50 text-center">scan to open profile in yard</p>
          <button onClick={onClose} className="btn-primary w-full mt-2">done</button>
        </div>
      </div>
    </div>
  )
}