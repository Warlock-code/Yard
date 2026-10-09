"use client"

import { useState } from "react"
import Avatar from "@/app/components/Avatar"

// NGL-style share: a pretty portrait card with a share button at the side.
// Tapping share sends the card as an IMAGE via the native share sheet
// (no raw link + no generic preview card). The link only travels inside
// the caption / copy button for the status link-sticker.
export default function AskShareCard({
  code,
  ghostId,
  avatarEmoji,
  campus,
}: {
  code: string
  ghostId: string
  avatarEmoji: string
  campus: string
}) {
  const [sharing, setSharing] = useState(false)
  const [copied, setCopied] = useState(false)
  const [note, setNote] = useState("")

  const link = `https://yardapp.me/ask/${code}`
  const caption = `ask ${ghostId} anything — anonymously 👀\n${link}`

  async function copyText(text: string, msg: string) {
    try {
      await navigator.clipboard.writeText(text)
      setCopied(true)
      setNote(msg)
      setTimeout(() => {
        setCopied(false)
        setNote("")
      }, 2500)
    } catch {
      setNote("copy failed — long-press the link to copy it.")
    }
  }

  async function handleShare() {
    if (sharing) return
    setSharing(true)
    setNote("")
    try {
      const res = await fetch(`/api/ask/story/${code}`)
      if (!res.ok) throw new Error("card failed")
      const blob = await res.blob()
      const file = new File([blob], "yard-ask.png", { type: "image/png" })
      const nav = navigator as Navigator & {
        share?: (d: { files?: File[]; title?: string; text?: string; url?: string }) => Promise<void>
        canShare?: (d: { files?: File[] }) => boolean
      }
      if (nav.canShare?.({ files: [file] }) && nav.share) {
        await nav.share({ files: [file], title: "ask me anonymously", text: caption })
        return
      }
      if (nav.share) {
        // Text-only share: still no preview card, link stays tappable.
        await nav.share({ title: "ask me anonymously", text: caption, url: link })
        return
      }
      throw new Error("no native share")
    } catch (err: unknown) {
      // User cancelling the sheet throws too — stay quiet for that case.
      if (err instanceof Error && /abort|cancel/i.test(err.message)) return
      const isMobile = typeof navigator !== "undefined" && /android|iphone|ipad/i.test(navigator.userAgent)
      if (isMobile) {
        // Mobile webviews often block blob downloads — open the card so it
        // can be long-pressed/saved, and copy the caption for the sticker.
        window.open(`/api/ask/story/${code}`, "_blank")
        await copyText(caption, "card opened in a new tab — save it, then paste the link as a sticker.")
      } else {
        try {
          const res = await fetch(`/api/ask/story/${code}`)
          const blob = await res.blob()
          const url = URL.createObjectURL(blob)
          const a = document.createElement("a")
          a.href = url
          a.download = "yard-ask-story.png"
          document.body.appendChild(a)
          a.click()
          a.remove()
          setTimeout(() => URL.revokeObjectURL(url), 5000)
          await copyText(caption, "card saved — post it to status, then paste the link as a sticker.")
        } catch {
          await copyText(caption, "card failed — link copied, paste it on status instead.")
        }
      }
    } finally {
      setSharing(false)
    }
  }

  return (
    <div>
      <div className="flex gap-3 items-stretch">
        <div className="relative flex-1 aspect-[9/16] max-h-[380px] overflow-hidden rounded-3xl border border-primary/30 bg-[#050505] flex flex-col items-center px-4 py-6 text-center">
          <div
            className="absolute top-0 left-1/2 -translate-x-1/2 w-56 h-56 rounded-full opacity-25 blur-3xl pointer-events-none"
            style={{ background: "radial-gradient(circle, #baff39, transparent 70%)" }}
          />
          <p className="brand-mark font-black text-base tracking-tight relative">
            YARD<span className="text-primary">.</span>
          </p>
          <div className="mt-4 relative">
            <Avatar emoji={avatarEmoji} size={64} />
          </div>
          <p className="text-[10px] text-white/40 uppercase tracking-widest mt-3 relative">ask anonymously</p>
          <p className="font-black text-lg leading-tight mt-1 relative">
            ask {ghostId}
            <br />
            anything
          </p>
          <p className="text-xs text-primary font-bold mt-1 relative">{campus}</p>
          <div className="flex-1" />
          <div className="w-full rounded-2xl bg-primary px-3 py-2.5 relative">
            <p className="text-black text-xs font-black leading-tight">send it — they will never know</p>
            <p className="text-black/60 text-[10px]">100% anonymous</p>
          </div>
        </div>

        <div className="flex flex-col gap-2 justify-center w-24 shrink-0">
          <button className="btn-primary flex-1 text-sm disabled:opacity-50" onClick={handleShare} disabled={sharing}>
            {sharing ? "..." : "📤\nshare"}
          </button>
          <button
            className="btn-ghost flex-1 text-xs"
            onClick={() => copyText(link, "link copied — add it as a sticker on your status.")}
          >
            {copied ? "✓" : "🔗"}
            <span className="block mt-0.5">{copied ? "copied" : "copy link"}</span>
          </button>
        </div>
      </div>
      {note ? (
        <p className="text-[11px] text-white/50 mt-2">{note}</p>
      ) : (
        <p className="text-[11px] text-white/30 mt-2">share sends the card as a picture — like ngl. add the link as a sticker on status.</p>
      )}
    </div>
  )
}
