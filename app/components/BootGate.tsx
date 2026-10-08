"use client"

import { useEffect, useState } from "react"

// Seamless cold-boot handoff: native splash holds (long launch duration)
// until this web bridge paints, then this bridge holds until content is
// ready. Colors match native splash + app/loading.tsx so the swap is
// invisible. Fail-open: always dismisses on timeout, never traps users.
export default function BootGate() {
  const [visible, setVisible] = useState(true)

  useEffect(() => {
    let cancelled = false

    const dismissNative = async () => {
      try {
        const cap = (window as unknown as { Capacitor?: { isNativePlatform?: () => boolean } }).Capacitor
        if (!cap?.isNativePlatform?.()) return
        const { SplashScreen } = await import("@capacitor/splash-screen")
        await SplashScreen.hide().catch(() => {})
      } catch {}
    }

    // Hide native only AFTER this overlay has painted one frame, so there
    // is never a blank gap between native splash and web bridge.
    const raf1 = requestAnimationFrame(() => {
      requestAnimationFrame(() => {
        if (!cancelled) void dismissNative()
      })
    })

    const dismiss = () => {
      if (cancelled) return
      cancelled = true
      setVisible(false)
      // Belt + suspenders: native must never stick even if early hide failed.
      void dismissNative()
      clearTimeout(failsafe)
    }

    const onReady = () => dismiss()
    window.addEventListener("yard:content-ready", onReady)

    // Failsafe so the bridge can never trap the app on a dead network.
    // Native shell is slower (cold WebView + TLS), web is fast.
    let isNative = false
    try {
      const cap = (window as unknown as { Capacitor?: { isNativePlatform?: () => boolean } }).Capacitor
      isNative = Boolean(cap?.isNativePlatform?.())
    } catch {}
    const failsafe = setTimeout(dismiss, isNative ? 9000 : 2500)

    return () => {
      cancelled = true
      cancelAnimationFrame(raf1)
      window.removeEventListener("yard:content-ready", onReady)
      clearTimeout(failsafe)
    }
  }, [])

  if (!visible) return null

  return (
    <div
      aria-hidden="true"
      style={{
        position: "fixed",
        inset: 0,
        zIndex: 200,
        backgroundColor: "#050505",
        color: "#f5f5f5",
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
      }}
    >
      <div style={{ textAlign: "center" }}>
        <p style={{ fontWeight: 900, fontSize: "28px", letterSpacing: "-0.02em" }}>
          YARD<span style={{ color: "#baff39" }}>.</span>
        </p>
        <p style={{ marginTop: "12px", fontSize: "13px", color: "rgba(255,255,255,0.40)" }}>
          waking up the yard…
        </p>
      </div>
    </div>
  )
}

// Pages call this once their first content has painted (feed posts,
// welcome/signup/login forms). BootGate listens for it and fades.
export function signalContentReady() {
  try {
    window.dispatchEvent(new Event("yard:content-ready"))
  } catch {}
}
