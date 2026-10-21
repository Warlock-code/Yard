"use client"

import { useEffect } from "react"

const BUILD_VAPID_PUBLIC_KEY = process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY || ""

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
 * NEXT_PUBLIC_* values are inlined by `next build`. If the key was missing
 * from the Vercel build environment the bundle contains an empty string and
 * subscribe() can never work. Fall back to the runtime endpoint so the key
 * always matches the private key the server signs with.
 */
async function resolveVapidPublicKey(): Promise<string> {
  if (BUILD_VAPID_PUBLIC_KEY) return BUILD_VAPID_PUBLIC_KEY

  const res = await fetch("/api/notifications/vapid-public-key", {
    cache: "no-store",
    credentials: "include",
  })
  const text = await res.text()
  let data: { publicKey?: unknown; error?: unknown } = {}
  try {
    data = text ? (JSON.parse(text) as { publicKey?: unknown; error?: unknown }) : {}
  } catch {
    throw new Error(`could not read VAPID key response (${res.status}): ${text.slice(0, 200)}`)
  }
  if (!res.ok || typeof data.publicKey !== "string" || !data.publicKey) {
    throw new Error(
      typeof data.error === "string" ? data.error : `VAPID public key is not configured (${res.status})`
    )
  }
  console.info("[push] using runtime VAPID public key")
  return data.publicKey
}

function sameApplicationServerKey(subscription: PushSubscription, expected: Uint8Array): boolean {
  const current = subscription.options.applicationServerKey
  if (!current) return false
  const bytes = new Uint8Array(current)
  if (bytes.length !== expected.length) return false
  for (let i = 0; i < bytes.length; i++) {
    if (bytes[i] !== expected[i]) return false
  }
  return true
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

    // The settings button owns the gesture, so ask even if push config is
    // missing — then fail gracefully below instead of leaving a dead button.
    if (opts?.requestPermission && Notification.permission === "default") {
      try {
        const permission = await Notification.requestPermission()
        if (permission !== "granted") {
          console.info("[push] permission not granted:", permission)
          return false
        }
      } catch (err) {
        console.log("[push] permission request failed (fail-open):", err)
        return false
      }
    }

    if (Notification.permission !== "granted") return false

    const vapidPublicKey = await resolveVapidPublicKey()
    const applicationServerKey = urlBase64ToUint8Array(vapidPublicKey)

    // Register explicitly before waiting for `ready`: on a first visit the
    // deferred layout registration may not have run yet, and `ready` would
    // otherwise hang forever. Registering twice is a no-op in browsers.
    await navigator.serviceWorker.register("/sw.js", { scope: "/" })
    const registration = await navigator.serviceWorker.ready
    let existing = await registration.pushManager.getSubscription()

    // A subscription created with a stale/different key can never receive
    // notifications signed by this server. Replace it.
    if (existing && !sameApplicationServerKey(existing, applicationServerKey)) {
      console.info("[push] replacing subscription created with a different VAPID key")
      await existing.unsubscribe().catch(() => {})
      existing = null
    }

    const subscription =
      existing ??
      (await registration.pushManager.subscribe({
        userVisibleOnly: true,
        applicationServerKey,
      }))

    const res = await fetch("/api/notifications/register", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      credentials: "include",
      body: JSON.stringify({ token: JSON.stringify(subscription), platform: "web-push" }),
    })
    if (!res.ok) {
      const text = await res.text().catch(() => "")
      throw new Error(`register failed (${res.status}): ${text.slice(0, 300)}`)
    }

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
