"use client"

import { useEffect, useState } from "react"
import Avatar from "@/app/components/Avatar"

// NGL-style flow: anyone can ask (no login). After sending, strangers get
// the download loop ("get your own questions"); logged-in users just
// get a confirmation + feed link.
export default function AskForm({ code, ghostId, avatarEmoji, campus }: {
  code: string
  ghostId: string
  avatarEmoji: string
  campus: string
}) {
  const [text, setText] = useState("")
  const [sending, setSending] = useState(false)
  const [sent, setSent] = useState(false)
  const [error, setError] = useState("")
  const [loggedIn, setLoggedIn] = useState<boolean | null>(null)
  const [linkCopied, setLinkCopied] = useState(false)
  const [imageSaving, setImageSaving] = useState(false)

  useEffect(() => {
    fetch("/api/auth/me", { credentials: "include" })
      .then((r) => (r.ok ? r.json() : null))
      .then((d) => setLoggedIn(Boolean(d?.user)))
      .catch(() => setLoggedIn(false))
  }, [])

  async function send() {
    const q = text.trim()
    if (!q || sending || sent) return
    setSending(true)
    setError("")
    try {
      const res = await fetch("/api/ask/send", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ code, text: q }),
      })
      const data = await res.json().catch(() => ({}))
      if (!res.ok) throw new Error(data.error || "couldn't send. try again.")
      setSent(true)
      setText("")
    } catch (err) {
      setError(err instanceof Error ? err.message : "couldn't send. try again.")
    } finally {
      setSending(false)
    }
  }

  return (
    <main className="min-h-screen max-w-md mx-auto px-5 py-10 flex flex-col items-center text-center">
      <p className="brand-mark font-black text-lg tracking-tight mb-6">
        YARD<span className="text-primary">.</span>
      </p>
      <div className="mb-3">
        <Avatar emoji={avatarEmoji} size={72} />
      </div>
      <p className="text-xs text-white/30 uppercase tracking-widest mb-1">ask anonymously</p>
      <h1 className="text-xl font-bold mb-1">{ghostId}</h1>
      <p className="text-xs text-white/40 mb-6">{campus}</p>

      {sent ? (
        <div className="w-full">
          <div className="card p-5 mb-3 border-primary/20 bg-primary/[0.06]">
            <p className="text-3xl mb-2">📮</p>
            <p className="font-bold mb-1">question sent!</p>
            <p className="text-sm text-white/50">they will see it anonymously — they will never know it was you.</p>
          </div>
          {loggedIn === true ? (
            <a href="/feed" className="btn-primary w-full block text-center">back to feed</a>
          ) : (
            <div className="card p-5 border-[#facc15]/25 bg-[#facc15]/[0.06]">
              <p className="font-bold mb-1">want your own anonymous questions? 👀</p>
              <p className="text-sm text-white/50 mb-4">get yard, share your link on status, watch the inbox fill up.</p>
              <a href={`/signup?ref=${encodeURIComponent(code)}`} className="btn-primary w-full block text-center mb-2">
                get yard — it is free
              </a>
              <a href="/download" className="block text-center text-sm font-semibold text-primary">
                or download the android app
              </a>
            </div>
          )}
        </div>
      ) : (
        <div className="w-full">
          <textarea
            className="input min-h-28 mb-3"
            placeholder={`ask ${ghostId} anything...`}
            value={text}
            onChange={(e) => setText(e.target.value)}
            maxLength={280}
          />
          {error && <p className="text-red-400 text-xs mb-3">{error}</p>}
          <button className="btn-primary w-full disabled:opacity-50" onClick={send} disabled={!text.trim() || sending}>
            {sending ? "sending..." : "send anonymously 👻"}
          </button>
          <p className="text-[11px] text-white/25 mt-3">100% anonymous • be kind-ish: no threats, no doxxing</p>
          <div className="mt-5 border-t border-white/10 pt-4">
            <p className="text-xs text-white/40 mb-2">is this your link? share it to status</p>
            <div className="flex gap-2">
              <button
                className="btn-ghost flex-1 text-sm"
                onClick={async () => {
                  const link = `https://yardapp.me/ask/${code}`
                  const shareText = `ask ${ghostId} anything — anonymously 👀\n${link}`
                  try {
                    const nav = navigator as Navigator & { share?: (d: { title?: string; text?: string; url?: string }) => Promise<void> }
                    if (nav.share) {
                      await nav.share({ title: "ask me anonymously", text: shareText, url: link })
                      return
                    }
                    throw new Error("no native share")
                  } catch {
                    try {
                      await navigator.clipboard.writeText(shareText)
                      setLinkCopied(true)
                      setTimeout(() => setLinkCopied(false), 1500)
                    } catch {}
                  }
                }}
              >
                {linkCopied ? "✓ copied" : "share 📤"}
              </button>
              <button
                className="btn-ghost flex-1 text-sm disabled:opacity-50"
                disabled={imageSaving}
                onClick={async () => {
                  if (imageSaving) return
                  setImageSaving(true)
                  try {
                    const res = await fetch(`/ask/${code}/opengraph-image`)
                    if (!res.ok) throw new Error("couldn't fetch image.")
                    const blob = await res.blob()
                    const url = URL.createObjectURL(blob)
                    const a = document.createElement("a")
                    a.href = url
                    a.download = "yard-ask-story.png"
                    document.body.appendChild(a)
                    a.click()
                    a.remove()
                    setTimeout(() => URL.revokeObjectURL(url), 5000)
                  } catch {}
                  finally {
                    setImageSaving(false)
                  }
                }}
              >
                {imageSaving ? "saving..." : "story image 🖼️"}
              </button>
            </div>
          </div>
        </div>
      )}
    </main>
  )
}
