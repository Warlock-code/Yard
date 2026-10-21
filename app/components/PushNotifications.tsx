"use client"

import { useEffect } from "react"

const BUILD_VAPID_PUBLIC_KEY = process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY || ""

export type NativePushPermission = "granted" | "denied" | "prompt" | "unknown"

export type PushSubscribeResult = {
  ok: boolean
  error?: string
  permission?: NativePushPermission
}

export type PushSubscriptionStatus = {
  subscribed: boolean
  current: boolean
  error?: string
  permission?: NativePushPermission
}

type NativePushPlugin = typeof import("@capacitor/push-notifications")["PushNotifications"]

export function isNativePushPlatform(): boolean {
  try {
    const cap = (
      window as unknown as {
        Capacitor?: { isNativePlatform?: () => boolean; getPlatform?: () => string }
      }
    ).Capacitor
    if (typeof cap?.isNativePlatform === "function") return cap.isNativePlatform() === true
    const platform = cap?.getPlatform?.()
    return platform === "android" || platform === "ios"
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

function normalizeNativePermission(value: unknown): NativePushPermission {
  if (value === "granted" || value === "denied") return value
  // Capacitor local-notifications uses "prompt-with-rationale" on Android.
  if (value === "prompt" || value === "prompt-with-rationale") return "prompt"
  return "unknown"
}

/**
 * Read/request the OS notification permission. The Capacitor push plugin is
 * preferred, but this APK may contain an older bridge that only has the custom
 * YardPush plugin. @capacitor/local-notifications uses the exact same Android
 * POST_NOTIFICATIONS permission, so it is a reliable fallback for the UI.
 */
async function resolveNativePermission(
  request: boolean
): Promise<{ permission: NativePushPermission; pushPluginUsable: boolean }> {
  const { Capacitor } = await import("@capacitor/core")

  if (Capacitor.isPluginAvailable("PushNotifications")) {
    try {
      const { PushNotifications } = await import("@capacitor/push-notifications")
      let permission = normalizeNativePermission((await PushNotifications.checkPermissions()).receive)
      if (permission === "prompt" && request) {
        permission = normalizeNativePermission((await PushNotifications.requestPermissions()).receive)
      }
      // "unknown" means the native bridge is present but its permission
      // response was not usable; let the local-notifications check decide.
      if (permission !== "unknown") return { permission, pushPluginUsable: true }
    } catch (error) {
      console.warn("[push] PushNotifications permission check failed:", formatPushError(error))
    }
  }

  try {
    const { LocalNotifications } = await import("@capacitor/local-notifications")
    let permission = normalizeNativePermission((await LocalNotifications.checkPermissions()).display)
    if (permission === "prompt" && request) {
      permission = normalizeNativePermission((await LocalNotifications.requestPermissions()).display)
    }
    return { permission, pushPluginUsable: false }
  } catch (error) {
    console.warn("[push] native notification permission check unavailable:", formatPushError(error))
    return { permission: "unknown", pushPluginUsable: false }
  }
}

async function getLegacyNativeToken(): Promise<string> {
  const { registerPlugin } = await import("@capacitor/core")
  const YardPush = registerPlugin<{ getToken: () => Promise<{ token?: string }> }>("YardPush")
  const result = await YardPush.getToken()
  const token = typeof result?.token === "string" ? result.token.trim() : ""
  if (!token) throw new Error("YardPush.getToken returned an empty token.")
  return token
}

async function registerNativeToken(token: string, platform: "android" | "ios"): Promise<PushSubscribeResult> {
  const res = await fetch("/api/notifications/register", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    credentials: "include",
    body: JSON.stringify({ token, platform }),
  })
  if (!res.ok) {
    const text = await res.text().catch(() => "")
    const message = `register failed (${res.status}): ${text.slice(0, 300)}`
    console.error("[push]", message)
    return { ok: false, error: message }
  }
  return { ok: true }
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

let nativeRegistrationInFlight: Promise<PushSubscribeResult> | null = null

async function waitForFcmToken(PushNotifications: NativePushPlugin): Promise<string> {
  return new Promise<string>((resolve, reject) => {
    let settled = false
    let timer: ReturnType<typeof setTimeout> | null = null
    let handles: Array<{ remove: () => Promise<void> }> = []

    const finish = (error: unknown, token?: string) => {
      if (settled) return
      settled = true
      if (timer) clearTimeout(timer)
      void Promise.allSettled(handles.map((handle) => handle.remove()))
      if (error) reject(error instanceof Error ? error : new Error(formatPushError(error)))
      else resolve(token || "")
    }

    timer = setTimeout(() => {
      finish(new Error("timed out waiting for FCM registration token (20s)."))
    }, 20000)

    const attach = async () => {
      try {
        const newHandles = await Promise.all([
          PushNotifications.addListener("registration", (token) => finish(null, token.value)),
          PushNotifications.addListener("registrationError", (error) =>
            finish(new Error(`registrationError: ${error.error || JSON.stringify(error)}`))
          ),
        ])
        // The 20s timeout may have fired before the native listeners attached.
        // Clean them up instead of leaking a listener that resolves nothing.
        if (settled) {
          await Promise.allSettled(newHandles.map((handle) => handle.remove()))
          return
        }
        handles = newHandles
        await PushNotifications.register()
      } catch (error) {
        finish(error)
      }
    }

    void attach()
  })
}

/**
 * Native Capacitor (Android APK / iOS shell) path. FCM issues the token;
 * the `registration` event hands it to us and we persist it as platform
 * "android" (or "ios") through the same register endpoint as web push.
 */
async function subscribeNativePush(opts?: {
  requestPermission?: boolean
}): Promise<PushSubscribeResult> {
  if (nativeRegistrationInFlight) return nativeRegistrationInFlight

  nativeRegistrationInFlight = (async () => {
    try {
      const { Capacitor } = await import("@capacitor/core")
      if (!Capacitor.isNativePlatform()) {
        return { ok: false, error: "not running inside the native app." }
      }

      const platform = Capacitor.getPlatform() === "ios" ? "ios" : "android"
      const { permission, pushPluginUsable } = await resolveNativePermission(!!opts?.requestPermission)
      let token = ""
      let pluginFailure = ""

      if (pushPluginUsable) {
        try {
          const { PushNotifications } = await import("@capacitor/push-notifications")
          if (platform === "android") {
            try {
              await PushNotifications.createChannel({
                id: "yard-v2",
                name: "Yard notifications",
                description: "Yard activity and announcements",
                importance: 5,
                visibility: 1,
                vibration: true,
              })
            } catch (error) {
              // Channel creation is best-effort; registration can still succeed.
              console.warn("[push] could not create Android notification channel:", formatPushError(error))
            }
          }

          token = await waitForFcmToken(PushNotifications)
          if (!token) throw new Error("FCM registration returned an empty token.")
        } catch (error) {
          pluginFailure = formatPushError(error)
          console.warn(
            "[push] PushNotifications registration failed; trying the YardPush native bridge:",
            pluginFailure
          )
        }
      } else {
        pluginFailure = "PushNotifications native plugin is unavailable in this APK."
        console.warn("[push]", pluginFailure, "— using the YardPush native bridge.")
      }

      // Older/rebuilt APKs can contain the YardPush bridge without the
      // Capacitor push plugin (the "plugin not implemented" case). The bridge
      // uses the same FirebaseMessaging token, so registration still works
      // without reinstalling the app.
      if (!token) {
        try {
          token = await getLegacyNativeToken()
          console.info("[push] native FCM token obtained from the YardPush bridge")
        } catch (fallbackError) {
          const fallback = formatPushError(fallbackError)
          const message = pluginFailure
            ? `${pluginFailure} YardPush fallback failed: ${fallback}`
            : `YardPush fallback failed: ${fallback}`
          console.error("[push] native subscribe failed:", message)
          return { ok: false, error: message, permission }
        }
      }

      const registered = await registerNativeToken(token, platform)
      if (!registered.ok) return { ...registered, permission }

      console.log(`[push] native ${platform} FCM token registered (permission: ${permission})`)
      return { ok: true, permission }
    } catch (error) {
      const message = formatPushError(error)
      console.error("[push] native subscribe failed:", message)
      return { ok: false, error: message }
    }
  })().finally(() => {
    nativeRegistrationInFlight = null
  })

  return nativeRegistrationInFlight
}

/**
 * Used by settings on load. Web: a stored subscription is only shown as
 * "enabled" when it was created with the key the server currently signs with.
 * Native: read the OS permission and (re)register the FCM token. This never
 * prompts; the settings button owns that user gesture.
 */
export async function getPushSubscriptionStatus(): Promise<PushSubscriptionStatus> {
  try {
    if (typeof window === "undefined") return { subscribed: false, current: false }
    if (isNativePushPlatform()) {
      const result = await subscribeNativePush()
      return {
        subscribed: result.ok,
        current: result.ok,
        error: result.error,
        permission: result.permission,
      }
    }
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
 * Shared subscribe logic for both transports (used by settings + notifications
 * page).
 * - Native Capacitor shells go through FCM (`@capacitor/push-notifications`)
 *   and register the token with platform "android"/"ios".
 * - Web browsers go through VAPID web push.
 * - `requestPermission: true` may only be passed from a user gesture
 *   (settings "enable" button). Background callers must leave it false so
 *   the browser/native shell never auto-prompts.
 * - On web, a manual enable always discards the old subscription first: a
 *   stale subscription created with a previous VAPID key makes subscribe()
 *   throw InvalidStateError and can never receive pushes signed by this
 *   server. Background callers only discard it when the stored key no longer
 *   matches.
 */
export async function subscribeForPush(opts?: {
  requestPermission?: boolean
  resetExisting?: boolean
}): Promise<PushSubscribeResult> {
  try {
    if (typeof window === "undefined") {
      return { ok: false, error: "window is not available." }
    }
    if (isNativePushPlatform()) {
      return await subscribeNativePush(opts)
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
        // Silent background path: never prompt. The settings page button owns
        // the user-action permission request. Native checks FCM permission
        // inside subscribeForPush; web checks the browser Notification API.
        const native = isNativePushPlatform()
        if (!native) {
          if (!("Notification" in window)) return
          if (Notification.permission !== "granted") return
        }

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
