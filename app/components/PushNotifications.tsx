"use client"

import { useEffect } from "react"

const BUILD_VAPID_PUBLIC_KEY = process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY || ""

export type PushSubscribeResult = {
  ok: boolean
  error?: string
}

export type PushSubscriptionStatus = {
  subscribed: boolean
  current: boolean
  error?: string
}

function isNativePlatform(): boolean {
  try {
    const cap = (window as unknown as { Capacitor?: { isNativePlatform?: () => boolean } }).Capacitor
    return cap?.isNativePlatform?.() === true
  } catch {
    return false
  }
}

function formatPushError(error: unknown): string {
  if (error instanceof Error) return `${error.name}: ${error.message}`
  if (typeof error === "object" && error !== null) {
    const candidate = error as { name?: unknown; message?: unknown }
    if (typeof candidate.name === "string" || typeof candidate.message === "string") {
      return `${candidate.name || "Error"}: ${candidate.message || String(error)}`
    }
  }
  return String(error)
}

function urlBase64ToUint8Array(base64String: string): Uint8Array<ArrayBuffer> {
  // The API returns base64url without padding. `atob` needs standard base64
  // with correct `=` padding, otherwise it throws and subscribe() never runs.
  const normalized = base64String.trim().replace(/^["']|["']$/g, "")
  if (!normalized) throw new Error("VAPID public key is empty.")
  const padding = "=".repeat((4 - (normalized.length % 4)) % 4)
  const base64 = (normalized + padding).replace(/-/g, "+").replace(/_/g, "/")

  let rawData: string
  try {
    rawData = window.atob(base64)
  } catch {
    throw new Error("VAPID public key is not valid base64url.")
  }

  const outputArray = new Uint8Array(rawData.length)
  for (let i = 0; i < rawData.length; ++i) {
    outputArray[i] = rawData.charCodeAt(i)
  }

  // An uncompressed P-256 public key is 65 bytes and starts with 0x04.
  if (outputArray.length !== 65 || outputArray[0] !== 4) {
    throw new Error(`VAPID public key has invalid length (${outputArray.length} bytes; expected 65).`)
  }
  return outputArray
}

/**
 * Always prefer the runtime key. NEXT_PUBLIC_* values are frozen at build
 * time; a stale/missing build value would create a subscription with a key
 * the server cannot sign for. The runtime endpoint derives the public key from
 * VAPID_PRIVATE_KEY, so the two can never drift.
 */
async function resolveVapidPublicKey(): Promise<string> {
  let runtimeError = "VAPID public key is not configured."

  try {
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
    if (res.ok && typeof data.publicKey === "string" && data.publicKey) {
      console.info("[push] using runtime VAPID public key")
      return data.publicKey
    }
    runtimeError =
      typeof data.error === "string" ? data.error : `VAPID public key endpoint returned ${res.status}.`
  } catch (error) {
    runtimeError = formatPushError(error)
  }

  if (BUILD_VAPID_PUBLIC_KEY) {
    console.warn("[push] runtime VAPID key unavailable; falling back to build-time key:", runtimeError)
    return BUILD_VAPID_PUBLIC_KEY
  }

  throw new Error(runtimeError)
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
 * Used by settings on load: a stored subscription is only shown as "enabled"
 * when it was created with the key the server currently signs with. Otherwise
 * the stale subscription is reported and the user can refresh it.
 */
export async function getPushSubscriptionStatus(): Promise<PushSubscriptionStatus> {
  try {
    if (typeof window === "undefined") return { subscribed: false, current: false }
    if (isNativePlatform()) return { subscribed: false, current: false }
    if (!("serviceWorker" in navigator) || !("PushManager" in window)) {
      return { subscribed: false, current: false }
    }

    const vapidPublicKey = await resolveVapidPublicKey()
    const expected = urlBase64ToUint8Array(vapidPublicKey)
    const registration = await navigator.serviceWorker.ready
    const subscription = await registration.pushManager.getSubscription()
    if (!subscription) return { subscribed: false, current: false }
    return { subscribed: true, current: sameApplicationServerKey(subscription, expected) }
  } catch (error) {
    return { subscribed: false, current: false, error: formatPushError(error) }
  }
}

/**
 * Shared web-push subscribe logic (used by settings + notifications page).
 * - Native Capacitor shells are always skipped.
 * - `requestPermission: true` may only be passed from a user gesture
 *   (settings "enable" button). Background callers must leave it false so
 *   the browser never auto-prompts.
 * - A manual enable always discards the old subscription first: a stale
 *   subscription created with a previous VAPID key makes subscribe() throw
 *   InvalidStateError and can never receive pushes signed by this server.
 *   Background callers only discard it when the stored key no longer matches.
 */
export async function subscribeForPush(opts?: {
  requestPermission?: boolean
  resetExisting?: boolean
}): Promise<PushSubscribeResult> {
  try {
    if (typeof window === "undefined") {
      return { ok: false, error: "window is not available." }
    }
    if (isNativePlatform()) {
      return { ok: false, error: "web push is not used inside the native app." }
    }
    if (!("serviceWorker" in navigator) || !("PushManager" in window)) {
      return { ok: false, error: "this browser does not support service worker push." }
    }
    if (!("Notification" in window)) {
      return { ok: false, error: "this browser does not support notifications." }
    }

    // The settings button owns the gesture, so ask before awaiting anything
    // else (Safari requires requestPermission to run inside the gesture).
    if (opts?.requestPermission && Notification.permission === "default") {
      let permission: NotificationPermission
      try {
        permission = await Notification.requestPermission()
      } catch (error) {
        const message = formatPushError(error)
        console.error("[push] permission request failed:", message)
        return { ok: false, error: message }
      }
      if (permission !== "granted") {
        return { ok: false, error: `notification permission ${permission}.` }
      }
    }

    if (Notification.permission !== "granted") {
      return { ok: false, error: `notification permission ${Notification.permission}.` }
    }

    const vapidPublicKey = await resolveVapidPublicKey()
    const applicationServerKey = urlBase64ToUint8Array(vapidPublicKey)

    // Register explicitly before waiting for `ready`: on a first visit the
    // deferred layout registration may not have run yet, and `ready` would
    // otherwise hang forever. Registering twice is a no-op in browsers.
    await navigator.serviceWorker.register("/sw.js", { scope: "/" })
    const registration = await navigator.serviceWorker.ready

    // Clear any existing subscription first when the user explicitly taps
    // "enable". It may have been created with an older VAPID key or belong to
    // a stale service-worker install; keeping it makes pushManager.subscribe()
    // throw InvalidStateError. Background callers only reset a key mismatch so
    // every page load does not churn the push endpoint.
    let existingSubscription = await registration.pushManager.getSubscription()
    const staleKey = existingSubscription
      ? !sameApplicationServerKey(existingSubscription, applicationServerKey)
      : false

    let subscription: PushSubscription | null = null
    if (existingSubscription && (opts?.resetExisting || staleKey)) {
      console.info(
        "[push] clearing existing subscription before resubscribe",
        opts?.resetExisting ? "(manual reset)" : "(stale VAPID key)"
      )
      try {
        await existingSubscription.unsubscribe()
        existingSubscription = null
      } catch (error) {
        const message = formatPushError(error)
        console.error("[push] existing subscription unsubscribe failed:", message)
        return { ok: false, error: `unsubscribe failed — ${message}` }
      }
    } else if (existingSubscription) {
      subscription = existingSubscription
    }

    if (!subscription) {
      try {
        subscription = await registration.pushManager.subscribe({
          userVisibleOnly: true,
          applicationServerKey,
        })
      } catch (error) {
        const message = formatPushError(error)
        console.error("[push] pushManager.subscribe failed:", message)
        return { ok: false, error: `subscribe failed — ${message}` }
      }
    }

    const res = await fetch("/api/notifications/register", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      credentials: "include",
      body: JSON.stringify({ token: JSON.stringify(subscription), platform: "web-push" }),
    })
    if (!res.ok) {
      const text = await res.text().catch(() => "")
      const message = `register failed (${res.status}): ${text.slice(0, 300)}`
      console.error("[push]", message)
      return { ok: false, error: message }
    }

    console.log("[push] subscription registered")
    return { ok: true }
  } catch (error) {
    const message = formatPushError(error)
    console.error("[push] subscribe failed:", message)
    return { ok: false, error: message }
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
        const result = await subscribeForPush()
        if (!result.ok) {
          console.warn("[push] background subscribe failed:", result.error)
        }
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
