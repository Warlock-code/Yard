"use client"

import { useEffect } from "react"

export default function SWRegistration() {
  useEffect(() => {
    if (!("serviceWorker" in navigator)) return
    // Native app shell must never register the web SW (no scope, competes
    // with WebView boot for bandwidth on cold start).
    try {
      const cap = (window as unknown as { Capacitor?: { isNativePlatform?: () => boolean } }).Capacitor
      if (cap?.isNativePlatform?.()) return
    } catch {}

    let cancelled = false
    let reloaded = false
    const reloadOnce = () => {
      if (reloaded || cancelled) return
      reloaded = true
      window.location.reload()
    }

    const register = () => {
      if (cancelled || document.hidden) {
        // Retry when visible instead of burning radio in background.
        window.setTimeout(() => { if (!cancelled) register() }, 5000)
        return
      }
      navigator.serviceWorker
        .register("/sw.js", { scope: "/" })
        .then((registration) => {
          console.log("SW registered:", registration.scope)

          registration.addEventListener("updatefound", () => {
            const newWorker = registration.installing
            if (newWorker) {
              newWorker.addEventListener("statechange", () => {
                // Only reload for real updates (a controller already owned
                // this page). First-install must NOT reload or cold open
                // pays for two full page loads.
                if (newWorker.state === "installed" && navigator.serviceWorker.controller) {
                  console.log("New SW available, refreshing...")
                  reloadOnce()
                }
              })
            }
          })
        })
        .catch((err) => {
          console.log("SW registration failed:", err)
        })
    }

    // Deferred well past first paint: SW install caches ~20 splash/icon
    // assets and must never contend with the feed's critical fetch.
    // NOTE: no unconditional controllerchange reload — that reloaded the
    // page on first install (double cold boot). Updates are handled above.
    const w = window as unknown as { requestIdleCallback?: (cb: () => void, opts?: { timeout: number }) => void }
    const schedule = () => {
      if (typeof w.requestIdleCallback === "function") {
        w.requestIdleCallback(register, { timeout: 8000 })
      } else {
        setTimeout(register, 4000)
      }
    }
    if (document.readyState === "complete") {
      const t = setTimeout(schedule, 3000)
      return () => { cancelled = true; clearTimeout(t) }
    }
    const onLoad = () => setTimeout(schedule, 3000)
    window.addEventListener("load", onLoad, { once: true })
    return () => {
      cancelled = true
      window.removeEventListener("load", onLoad)
    }
  }, [])

  return null
}