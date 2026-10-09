"use client"

import { useCallback, useEffect, useState } from "react"
import { useRouter } from "next/navigation"
import { apiGet, apiPatch, apiPost } from "@/lib/useApi"

type Nudge = {
  id: string
  type: string
  title: string
  body: string
  href: string
  createdAt: string
}

function ctaFor(nudge: Nudge): { label: string; href: string } {
  if (nudge.type === "nudge_boost_popping") return { label: "boost post", href: nudge.href }
  if (nudge.type === "nudge_post_heating") return { label: "jump in 💬", href: nudge.href }
  if (nudge.type === "nudge_top_reply") return { label: "view reply 🏆", href: nudge.href }
  if (nudge.type === "nudge_avatar") return { label: "pick avatar", href: "/shop" }
  if (nudge.type === "nudge_streak_freeze") return { label: "freeze streak", href: "/shop" }
  if (nudge.type === "nudge_plus") return { label: "go plus", href: "/upgrade" }
  if (nudge.type === "nudge_custom_name") return { label: "change name", href: "/lair" }
  if (nudge.type === "nudge_first_buy") return { label: "shop first buy", href: "/shop" }
  if (nudge.type === "nudge_storage") return { label: "get space", href: "/shop" }
  if (nudge.type === "nudge_comeback") return { label: "post now", href: "/compose" }
  return { label: "open", href: nudge.href }
}

function iconFor(nudge: Nudge): string {
  if (nudge.type === "nudge_post_heating") return "🔥"
  if (nudge.type === "nudge_top_reply") return "🏆"
  if (nudge.type === "nudge_boost_popping") return "🚀"
  if (nudge.type === "nudge_streak_freeze") return "🧊"
  if (nudge.type === "nudge_comeback") return "👻"
  return "✨"
}

function postIdFromHref(href: string): string | null {
  const m = href.match(/\/post\/([A-Za-z0-9_-]+)/)
  return m ? m[1] : null
}

export default function SmartNudge({ compact = false }: { compact?: boolean }) {
  const router = useRouter()
  const [nudges, setNudges] = useState<Nudge[]>([])
  const [busyId, setBusyId] = useState<string | null>(null)

  useEffect(() => {
    let active = true
    apiGet<{ nudges?: Nudge[] }>("/api/nudges")
      .then((d) => {
        if (active && Array.isArray(d?.nudges)) setNudges((d.nudges as Nudge[]).slice(0, compact ? 1 : 3))
      })
      .catch(() => {})
    return () => { active = false }
  }, [compact])

  const dismiss = useCallback(async (id: string) => {
    setNudges((prev) => prev.filter((n) => n.id !== id))
    apiPatch("/api/notifications", { id }).catch(() => {})
  }, [])

  const act = useCallback(async (nudge: Nudge) => {
    // Boost nudge acts inline: burn free boost or 300 credits for 24h
    if (nudge.type === "nudge_boost_popping") {
      const postId = postIdFromHref(nudge.href)
      if (postId) {
        setBusyId(nudge.id)
        try {
          const data = await apiPost<{ success?: boolean }>(`/api/boost/${postId}`, {})
          if (data?.success) {
            await dismiss(nudge.id)
            router.push(`/post/${postId}`)
            return
          }
        } catch (err) {
          alert(err instanceof Error ? err.message : "boost failed.")
          setBusyId(null)
          return
        } finally {
          setBusyId(null)
        }
      }
    }
    const cta = ctaFor(nudge)
    await dismiss(nudge.id)
    router.push(cta.href)
  }, [dismiss, router])

  if (nudges.length === 0) return null

  return (
    <div className={`space-y-2 ${compact ? "" : "px-4 pt-3"}`}>
      {nudges.map((nudge) => {
        const cta = ctaFor(nudge)
        return (
          <div
            key={nudge.id}
            className="rounded-xl border border-[#baff39]/30 bg-[#baff39]/[0.06] p-3 flex items-start gap-3"
          >
            <span className="text-xl leading-none mt-0.5">{iconFor(nudge)}</span>
            <div className="flex-1 min-w-0">
              <p className="font-semibold text-sm">{nudge.title}</p>
              <p className="text-[13px] text-white/60 mt-0.5 leading-snug">{nudge.body}</p>
              <div className="flex gap-2 mt-2">
                <button
                  className="btn-primary px-4 h-8 text-xs disabled:opacity-50"
                  disabled={busyId === nudge.id}
                  onClick={() => act(nudge)}
                >
                  {busyId === nudge.id ? "..." : cta.label}
                </button>
                <button
                  className="text-xs text-white/40 hover:text-white/70 px-2"
                  onClick={() => dismiss(nudge.id)}
                  aria-label="dismiss"
                >
                  later
                </button>
              </div>
            </div>
          </div>
        )
      })}
    </div>
  )
}
