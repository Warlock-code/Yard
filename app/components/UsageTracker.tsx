"use client"

import { useEffect } from "react"

// Live-safe usage tracker. Fire-and-forget only: never throws, never blocks
// rendering, never shows UI. If /api/track is missing (pre-deploy) or the DB
// tables don't exist yet, every beacon fails silently.
const HEARTBEAT_MS = 30_000

export default function UsageTracker() {
  useEffect(() => {
    try {
      let sessionId: string | null = null
      try {
        sessionId = window.sessionStorage.getItem("yard_session_id")
      } catch {
        sessionId = null
      }
      let stopped = false

      const post = (payload: Record<string, unknown>) => {
        try {
          fetch("/api/track", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify(payload),
            keepalive: true,
            credentials: "include",
          }).catch(() => {})
        } catch {
          // never break the app
        }
      }

      const start = async () => {
        if (sessionId) return
        try {
          const res = await fetch("/api/track", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({
              type: "session_start",
              pathname: window.location.pathname.slice(0, 200),
            }),
            credentials: "include",
          })
          const data = (await res.json().catch(() => ({}))) as { sessionId?: string }
          if (data?.sessionId) {
            sessionId = data.sessionId
            try {
              window.sessionStorage.setItem("yard_session_id", sessionId)
            } catch {}
          }
        } catch {}
      }

      void start()

      const beat = () => {
        if (stopped || document.hidden || !sessionId) return
        post({
          type: "heartbeat",
          sessionId,
          durationSec: 30,
          pathname: window.location.pathname.slice(0, 200),
        })
      }
      const iv = window.setInterval(beat, HEARTBEAT_MS)

      const onHide = () => {
        try {
          if (!sessionId) return
          const payload = JSON.stringify({ type: "session_end", sessionId })
          if (navigator.sendBeacon) {
            try {
              navigator.sendBeacon("/api/track", new Blob([payload], { type: "application/json" }))
              return
            } catch {}
          }
          post({ type: "session_end", sessionId })
        } catch {}
      }
      window.addEventListener("pagehide", onHide)

      return () => {
        stopped = true
        window.clearInterval(iv)
        window.removeEventListener("pagehide", onHide)
        onHide()
      }
    } catch {
      // absolute last resort — never break render
    }
    return undefined
  }, [])

  return null
}
