"use client"

import { useEffect } from "react"

const VAPID_PUBLIC_KEY = process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY || ""

function isNativePlatform(): boolean {
  try {
    const cap = (window as unknown as { Capacitor?: { isNativePlatform?: () => boolean } }).Capacitor
    return cap?.isNativePlatform?.() === true
  } catch {
    return false
  }
}

function urlBase64ToUint8Array(base64String: string) {
  const padding = "=".repeat((4 - (base64String.length % 4)) % 4)
  const base64 = (base64String + padding).replace(/-/g, "+").replace(/_/g, "/")
  const rawData = window.atob(base64)
  const outputArray = new Uint8Array(rawData.length)
  for (let i = 0; i < rawData.length; ++i) {
    outputArray[i] = rawData.charCodeAt(i)
  }
  return outputArray
}

/**
 * Shared web-push subscribe logic (used by settings + notifications page).
 * - Native Capacitor shells are always skipped.
 * - `requestPermission: true` may only be passed from a user gesture
 *   (settings "enable" button). Background callers must leave it false so
 *   the browser never auto-prompts.
 * - Fail-open: returns false on any problem, never throws.
 */
export async function subscribeForPush(opts?: { requestPermission?: boolean }): Promise<boolean> {
  try {
    if (typeof window === "undefined") return false
    if (isNativePlatform()) return false
    if (!("serviceWorker" in navigator) || !("PushManager" in window)) return false
    if (!("Notification" in window)) return false
    if (!VAPID_PUBLIC_KEY) {
      console.log("[push] missing VAPID public key, skipping subscribe")
      return false
    }

    if (opts?.requestPermission && Notification.permission === "default") {
      try {
        await Notification.requestPermission()
      } catch (err) {
        console.log("[push] permission request failed (fail-open):", err)
        return false
      }
    }

    if (Notification.permission !== "granted") return false

    const registration = await navigator.serviceWorker.ready
    const existing = await registration.pushManager.getSubscription()
    const subscription =
      existing ??
      (await registration.pushManager.subscribe({
        userVisibleOnly: true,
        applicationServerKey: urlBase64ToUint8Array(VAPID_PUBLIC_KEY),
      }))

    await fetch("/api/notifications/register", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      credentials: "include",
      body: JSON.stringify({ token: JSON.stringify(subscription), platform: "web-push" }),
    }).then((res) => {
      if (!res.ok) throw new Error(`register failed (${res.status})`)
    })

    console.log("[push] subscription registered")
    return true
  } catch (err) {
    console.log("[push] subscribe failed (fail-open):", err)
    return false
  }
}

export default function PushNotificationsSetup() {
  useEffect(() => {
    let cancelled = false

    const run = async () => {
      try {
        // Skip native shells entirely — push there goes through FCM/Capacitor.
        if (isNativePlatform()) return
        if (!("Notification" in window)) return
        // Silent background path: never prompt. The settings page button
        // owns the user-action permission request.
        if (Notification.permission !== "granted") return

        // Authenticated-only: anonymous visitors must not create subscriptions.
        try {
          const meRes = await fetch("/api/auth/me", { credentials: "include" })
          if (!meRes.ok) return
          const meData = (await meRes.json().catch(() => null)) as { user?: unknown } | null
          if (!meData?.user) return
        } catch {
          return
        }

        if (cancelled) return
        await subscribeForPush()
      } catch (err) {
        console.log("[push] background setup failed (fail-open):", err)
      }
    }

    // Defer past first paint so SW install + feed fetch win the radio.
    const w = window as unknown as {
      requestIdleCallback?: (cb: () => void, opts?: { timeout: number }) => number
      cancelIdleCallback?: (id: number) => void
    }
    let idleId: number | null = null
    let timer: ReturnType<typeof setTimeout> | null = null
    if (typeof w.requestIdleCallback === "function") {
      idleId = w.requestIdleCallback(run, { timeout: 8000 })
    } else {
      timer = setTimeout(run, 4000)
    }
    return () => {
      cancelled = true
      if (idleId !== null) w.cancelIdleCallback?.(idleId)
      if (timer !== null) clearTimeout(timer)
    }
  }, [])

  return null
}
