"use client"

import { useEffect, useRef, useState } from "react"
import { usePathname, useRouter } from "next/navigation"

// Home for logged-in users. Back from anywhere in the main app goes here
// instead of killing the app. Only on home does back ask to exit.
const HOME_PATH = "/feed"

// Auth / entry pages: leave the system back behavior alone (manual history.back).
const PASS_THROUGH_PATHS = [
  "/",
  "/login",
  "/signup",
  "/verify-email",
  "/forgot-password",
  "/reset-password",
  "/welcome",
  "/download",
]

const DOUBLE_PRESS_MS = 2000

export default function AndroidBackHandler() {
  const pathname = usePathname()
  const router = useRouter()
  const [showExitHint, setShowExitHint] = useState(false)
  const pathnameRef = useRef(pathname)
  const routerRef = useRef(router)
  const lastBackRef = useRef(0)
  const hintTimerRef = useRef<number | null>(null)

  // Keep latest route/router for the native back-button callback.
  // Ref writes live inside effects (never during render).
  useEffect(() => {
    pathnameRef.current = pathname
    routerRef.current = router
    lastBackRef.current = 0
  }, [pathname, router])

  useEffect(() => {
    let removeListener: (() => void) | null = null
    let cancelled = false

    async function setup() {
      try {
        if (typeof window === "undefined") return
        const [{ App }, { Capacitor }] = await Promise.all([
          import("@capacitor/app"),
          import("@capacitor/core"),
        ])
        if (cancelled) return
        if (!Capacitor.isNativePlatform()) return
        if (Capacitor.getPlatform() !== "android") return

        const handle = await App.addListener("backButton", ({ canGoBack }) => {
          try {
            const current = pathnameRef.current || "/"

            // 1. Dismiss an open native <dialog> first, don't navigate away.
            const openDialog = document.querySelector("dialog[open]")
            if (openDialog instanceof HTMLDialogElement) {
              openDialog.close()
              return
            }

            // 2. Auth / entry screens: keep normal system back.
            if (
              PASS_THROUGH_PATHS.includes(current) ||
              current.startsWith("/payment/")
            ) {
              if (canGoBack) window.history.back()
              return
            }

            // 3. Anywhere else that isn't home: go home, never exit.
            if (current !== HOME_PATH) {
              lastBackRef.current = 0
              setShowExitHint(false)
              routerRef.current.push(HOME_PATH)
              return
            }

            // 4. Already home: TikTok-style double-press to exit.
            const now = Date.now()
            if (now - lastBackRef.current < DOUBLE_PRESS_MS) {
              lastBackRef.current = 0
              setShowExitHint(false)
              if (hintTimerRef.current !== null) {
                window.clearTimeout(hintTimerRef.current)
                hintTimerRef.current = null
              }
              void App.exitApp().catch(() => {})
              return
            }

            lastBackRef.current = now
            setShowExitHint(true)
            if (hintTimerRef.current !== null) {
              window.clearTimeout(hintTimerRef.current)
            }
            hintTimerRef.current = window.setTimeout(() => {
              setShowExitHint(false)
              hintTimerRef.current = null
            }, DOUBLE_PRESS_MS)
          } catch {
            // Never break the app from a back-press handler.
          }
        })

        if (cancelled) {
          void handle.remove().catch(() => {})
          return
        }
        removeListener = () => {
          void handle.remove().catch(() => {})
        }
      } catch {
        // Capacitor missing / web build — do nothing, web back button stays normal.
      }
    }

    void setup()

    return () => {
      cancelled = true
      if (hintTimerRef.current !== null) {
        window.clearTimeout(hintTimerRef.current)
        hintTimerRef.current = null
      }
      if (removeListener) removeListener()
    }
  }, [])

  // Only ever show the hint on home. If the user navigates away while it is
  // visible, it disappears on the next render with no extra effect needed.
  if (!showExitHint || pathname !== HOME_PATH) return null

  return (
    <div
      role="status"
      aria-live="polite"
      className="pointer-events-none fixed bottom-[calc(5.5rem+env(safe-area-inset-bottom,0px))] left-0 right-0 z-50 flex justify-center px-4"
    >
      <div className="rounded-full bg-white px-4 py-2 text-[13px] font-medium text-black shadow-lg">
        Press back again to exit
      </div>
    </div>
  )
}
