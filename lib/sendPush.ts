import { google } from "googleapis"
import webpush from "web-push"
import { prisma } from "@/lib/prisma"

type FirebaseServiceAccount = {
  project_id: string
  client_email: string
  private_key: string
}

function getServiceAccount(): FirebaseServiceAccount | null {
  const raw = process.env.FIREBASE_SERVICE_ACCOUNT?.trim()
  if (!raw) {
    console.error("FCM is not configured: FIREBASE_SERVICE_ACCOUNT is missing")
    return null
  }

  try {
    const unwrapped = raw.replace(/^'([\s\S]*)'$/, "$1").replace(/^\"([\s\S]*)\"$/, "$1")
    const key = JSON.parse(unwrapped) as FirebaseServiceAccount
    if (!key.project_id || !key.client_email || !key.private_key) throw new Error("Incomplete Firebase service account")
    return { ...key, private_key: key.private_key.replace(/\\n/g, "\n") }
  } catch (error) {
    console.error("FCM is not configured: invalid FIREBASE_SERVICE_ACCOUNT", error)
    return null
  }
}

async function getAccessToken() {
  const key = getServiceAccount()
  if (!key) return null
  const jwtClient = new google.auth.JWT({
    email: key.client_email,
    key: key.private_key,
    scopes: ["https://www.googleapis.com/auth/firebase.messaging"],
  })
  const tokens = await jwtClient.authorize()
  return tokens.access_token
}

// Web Push subscriptions are stored as JSON strings like
// {"endpoint":"https://fcm.googleapis.com/fcm/send/...","keys":{...}}.
// Raw FCM registration tokens are short opaque strings.
export function isWebPushSubscription(token: string): boolean {
  const trimmed = token.trim()
  if (!trimmed.startsWith("{")) return false
  try {
    const parsed = JSON.parse(trimmed) as { endpoint?: unknown; keys?: unknown }
    return typeof parsed.endpoint === "string" && typeof parsed.keys === "object" && parsed.keys !== null
  } catch {
    return false
  }
}

let vapidConfigured = false
function ensureVapid(): boolean {
  if (vapidConfigured) return true
  const publicKey = process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY?.trim()
  const privateKey = process.env.VAPID_PRIVATE_KEY?.trim()
  if (!publicKey || !privateKey) {
    console.error("Web Push is not configured: VAPID keys are missing")
    return false
  }
  try {
    webpush.setVapidDetails("mailto:hello@yardapp.me", publicKey, privateKey)
    vapidConfigured = true
    return true
  } catch (error) {
    console.error("Web Push VAPID setup failed", error)
    return false
  }
}

async function sendWebPush(subscriptionJson: string, title: string, body: string, href?: string) {
  if (!ensureVapid()) return
  const subscription = JSON.parse(subscriptionJson) as {
    endpoint: string
    keys?: { p256dh?: string; auth?: string }
  }
  try {
    await webpush.sendNotification(
      subscription,
      JSON.stringify({ title, body, href: href ?? "/notifications", icon: "/icon-192.png" }),
      { TTL: 24 * 60 * 60 }
    )
  } catch (error: unknown) {
    // 404/410 = subscription expired or revoked: drop the stale token so
    // future sends don't keep failing.
    const statusCode = (error as { statusCode?: number })?.statusCode
    if (statusCode === 404 || statusCode === 410) {
      await prisma.deviceToken.deleteMany({ where: { token: subscriptionJson } }).catch(() => {})
      await prisma.user.updateMany({ where: { pushToken: subscriptionJson }, data: { pushToken: null } }).catch(() => {})
      console.info("Web Push subscription expired, token removed")
      return
    }
    console.error("Web Push notification failed", error instanceof Error ? error.message : error)
  }
}

async function sendFcm(pushToken: string, title: string, body: string, href?: string) {
  try {
    const key = getServiceAccount()
    if (!key) return
    const accessToken = await getAccessToken()
    if (!accessToken) return

    const response = await fetch(`https://fcm.googleapis.com/v1/projects/${key.project_id}/messages:send`, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${accessToken}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        message: {
          token: pushToken,
          notification: { title, body },
          android: {
            priority: "HIGH",
            notification: {
              channel_id: "yard-v2",
              sound: "default",
              default_sound: true,
              default_vibrate_timings: true,
            },
          },
          data: href ? { href } : undefined,
        },
      }),
    })

    if (!response.ok) {
      const errorBody = await response.text()
      // Unregistered device: drop the stale token.
      if (response.status === 404 && errorBody.includes("UNREGISTERED")) {
        await prisma.deviceToken.deleteMany({ where: { token: pushToken } }).catch(() => {})
        await prisma.user.updateMany({ where: { pushToken }, data: { pushToken: null } }).catch(() => {})
        console.info("FCM token unregistered, token removed")
        return
      }
      console.error("FCM notification failed", response.status, errorBody)
    }
  } catch (error) {
    console.error("FCM notification could not be sent", error)
  }
}

// Route a stored token to the right transport. Never throws: push must not
// break the notification/comment/vote flow that triggered it.
export async function sendPush(pushToken: string, title: string, body: string, href?: string) {
  if (!pushToken) {
    console.error("Push skipped: recipient has no registered device token")
    return
  }
  try {
    if (isWebPushSubscription(pushToken)) {
      await sendWebPush(pushToken, title, body, href)
    } else {
      await sendFcm(pushToken, title, body, href)
    }
  } catch (error) {
    console.error("Push could not be sent", error)
  }
}

// Backwards-compatible alias for callers importing { sendFcm }.
export { sendFcm }
