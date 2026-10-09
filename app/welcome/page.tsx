"use client"

import { useEffect, useState } from "react"
import { useRouter } from "next/navigation"
import { signalContentReady } from "@/app/components/BootGate"

type PreviewPost = {
  id: string
  text: string | null
  yeahs: number
  commentsCount: number
  user: { ghostId: string; avatarEmoji: string }
}

export default function WelcomePage() {
  const router = useRouter()
  const [preview, setPreview] = useState<PreviewPost[] | null>(null)

  useEffect(() => {
    signalContentReady()
  }, [])

  // Live social proof: show real gist to first-time visitors.
  // Fails silent — the page works exactly as before with no posts.
  useEffect(() => {
    let active = true
    fetch("/api/posts?mode=all")
      .then((res) => (res.ok ? res.json() : null))
      .then((data) => {
        if (!active) return
        const posts = Array.isArray(data?.posts) ? data.posts : []
        if (posts.length > 0) setPreview(posts.slice(0, 3))
      })
      .catch(() => {})
    return () => {
      active = false
    }
  }, [])

  function handleContinue() {
    document.cookie = "yard_seen_welcome=1; path=/; max-age=" + 60 * 60 * 24 * 365
    router.push("/signup")
  }

  return (
    <main className="min-h-screen flex flex-col justify-center px-6 max-w-md mx-auto">
      <h1 className="text-3xl font-black mb-2">welcome to yard<span className="text-[#baff39]">.</span></h1>
      <p className="text-white/60 text-sm mb-6">your campus whisper network.</p>

      {preview && (
        <button
          onClick={() => router.push("/feed")}
          className="block w-full text-left card p-4 mb-6 hover:border-white/20"
          aria-label="peek the live yard feed"
        >
          <p className="text-xs font-bold text-[#baff39] mb-2">🔥 live on yard right now</p>
          <div className="space-y-3">
            {preview.map((post) => (
              <div key={post.id} className="border-b border-white/[0.06] pb-3 last:border-0 last:pb-0">
                <p className="text-xs text-white/40 mb-0.5">
                  {post.user.avatarEmoji} {post.user.ghostId}
                </p>
                <p className="text-sm text-white/85 line-clamp-2 clamp-2">{post.text || "(photo gist)"}</p>
                <p className="text-[11px] text-white/30 mt-1">🔥 {post.yeahs} · 💬 {post.commentsCount}</p>
              </div>
            ))}
          </div>
          <p className="text-[#baff39] text-sm font-semibold mt-3">tap to peek the yard →</p>
        </button>
      )}

      <div className="space-y-4 text-sm text-white/80 mb-8">
        <div>
          <p className="font-semibold text-white mb-1">👻 you post as a ghost</p>
          <p>no real name, no real photo. just your anonymous identity, verified once with your school email.</p>
        </div>
        <div>
          <p className="font-semibold text-white mb-1">✉️ verifying is simple</p>
          <p>sign up with your school email. then check your school&apos;s inbox (gctu students: log into your outlook mailbox) for a 6-digit code.</p>
        </div>
        <div>
          <p className="font-semibold text-white mb-1">⚖️ the rules</p>
          <p>say what you want — roast, joke, confess, argue. just no threats, no doxxing, no csam. everything else is fair game.</p>
        </div>
      </div>

      <button className="btn-primary w-full" onClick={handleContinue}>
        get started
      </button>
      <button
        onClick={() => router.push("/feed")}
        className="block w-full text-center text-white/50 text-sm font-semibold mt-3"
      >
        just looking? peek the yard →
      </button>
      <a
        href="/download"
        className="block text-center text-[#baff39] text-sm font-semibold mt-4"
      >
        download the android app
      </a>
    </main>
  )
}