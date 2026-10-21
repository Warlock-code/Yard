import { google } from "googleapis"
import webpush from "web-push"
import { prisma } from "@/lib/prisma"
import { getVapidConfig } from "@/lib/vapid"

type FirebaseServiceAccount = {
  project_id: string
  client_email: string
  private_key: string
}

export type PushSendResult = {
  ok: boolean
  transport: "web-push" | "fcm" | "none"
  statusCode?: number
  body?: string
  error?: string
  endpointHost?: string
  removed?: boolean
}

function getServiceAccount(): FirebaseServiceAccount | null {
  const raw = process.env.FIREBASE_SERVICE_ACCOUNT?.trim()
  if (!raw) {
    console.error("[PUSH CONFIG] FCM is not configured: FIREBASE_SERVICE_ACCOUNT is missing")
    return null
  }

  try {
    const unwrapped = raw.replace(/^'([\s\S]*)'$/, "$1").replace(/^\"([\s\S]*)\"$/, "$1")
    const key = JSON.parse(unwrapped) as FirebaseServiceAccount
    if (!key.project_id || !key.client_email || !key.private_key) throw new Error("Incomplete Firebase service account")
    return { ...key, private_key: key.private_key.replace(/\\n/g, "\n") }
  } catch (error) {
    console.error("[PUSH CONFIG] FCM is not configured: invalid FIREBASE_SERVICE_ACCOUNT", error)
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

function ensureVapid(): { ok: true } | { ok: false; error: string } {
  const config = getVapidConfig()
  if (!config.configured) {
    const message = config.warning || "VAPID keys are missing."
    console.error("[PUSH CONFIG]", message)
    return { ok: false, error: message }
  }
  try {
    webpush.setVapidDetails("mailto:hello@yardapp.me", config.publicKey, config.privateKey)
    return { ok: true }
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error)
    console.error("[PUSH CONFIG] VAPID setup failed", error)
    return { ok: false, error: message }
  }
}

function endpointHost(subscriptionJson: string): string | undefined {
  try {
    return new URL((JSON.parse(subscriptionJson) as { endpoint?: string }).endpoint || "").host
  } catch {
    return undefined
  }
}

async function deleteDeadToken(token: string, reason: string) {
  try {
    await prisma.deviceToken.deleteMany({ where: { token } })
    await prisma.user.updateMany({ where: { pushToken: token }, data: { pushToken: null } })
    console.error("[PUSH ERROR] removed dead token", reason)
  } catch (error) {
    console.error("[PUSH ERROR] could not remove dead token", error)
  }
}

async function sendWebPush(
  subscriptionJson: string,
  title: string,
  body: string,
  href?: string
): Promise<PushSendResult> {
  const vapid = ensureVapid()
  if (!vapid.ok) {
    return { ok: false, transport: "web-push", error: vapid.error }
  }

  let subscription: { endpoint: string; keys?: { p256dh?: string; auth?: string } }
  try {
    subscription = JSON.parse(subscriptionJson) as {
      endpoint: string
      keys?: { p256dh?: string; auth?: string }
    }
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error)
    console.error("[PUSH ERROR] invalid subscription JSON", message)
    return { ok: false, transport: "web-push", error: `invalid subscription JSON: ${message}` }
  }

  const host = endpointHost(subscriptionJson)
  try {
    const result = await webpush.sendNotification(
      subscription,
      JSON.stringify({ title, body, href: href ?? "/notifications", icon: "/icon-192.png" }),
      { TTL: 24 * 60 * 60 }
    )
    return {
      ok: true,
      transport: "web-push",
      statusCode: result.statusCode,
      body: result.body,
      endpointHost: host,
    }
  } catch (error: unknown) {
    // Do not swallow this: Vercel logs must show the push service's exact
    // rejection reason (401 key mismatch, 403 VAPID mismatch, 404/410 dead
    // subscription, 413 payload too large, etc.).
    const err = error as { statusCode?: number; body?: string; message?: string }
    console.error("[PUSH ERROR]", err.statusCode, err.body ?? err.message)

    // 404/410 = subscription expired or revoked: drop the stale token so
    // future sends don't keep failing.
    if (err.statusCode === 404 || err.statusCode === 410) {
      await deleteDeadToken(subscriptionJson, `web push ${err.statusCode} (${host || "unknown host"})`)
      return {
        ok: false,
        transport: "web-push",
        statusCode: err.statusCode,
        body: err.body,
        error: err.message,
        endpointHost: host,
        removed: true,
      }
    }

    return {
      ok: false,
      transport: "web-push",
      statusCode: err.statusCode,
      body: err.body,
      error: err.message,
      endpointHost: host,
    }
  }
}

async function sendFcm(
  pushToken: string,
  title: string,
  body: string,
  href?: string
): Promise<PushSendResult> {
  try {
    const key = getServiceAccount()
    if (!key) return { ok: false, transport: "fcm", error: "FCM is not configured." }
    const accessToken = await getAccessToken()
    if (!accessToken) return { ok: false, transport: "fcm", error: "Could not obtain an FCM access token." }

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

    const responseBody = await response.text()
    if (!response.ok) {
      console.error("[PUSH ERROR]", response.status, responseBody)
      // Unregistered/invalid device: drop the stale token.
      if (
        response.status === 404 &&
        (responseBody.includes("UNREGISTERED") || responseBody.includes("NOT_FOUND"))
      ) {
        await deleteDeadToken(pushToken, `fcm ${response.status} UNREGISTERED`)
        return {
          ok: false,
          transport: "fcm",
          statusCode: response.status,
          body: responseBody,
          error: "FCM token is unregistered.",
          removed: true,
        }
      }
      return {
        ok: false,
        transport: "fcm",
        statusCode: response.status,
        body: responseBody,
        error: `FCM request failed (${response.status}).`,
      }
    }

    return {
      ok: true,
      transport: "fcm",
      statusCode: response.status,
      body: responseBody,
    }
  } catch (error) {
    console.error("[PUSH ERROR]", error)
    return {
      ok: false,
      transport: "fcm",
      error: error instanceof Error ? error.message : String(error),
    }
  }
}

// Route a stored token to the right transport. Never throws: push must not
// break the notification/comment/vote flow that triggered it.
export async function sendPush(
  pushToken: string,
  title: string,
  body: string,
  href?: string
): Promise<PushSendResult> {
  if (!pushToken) {
    console.error("[PUSH ERROR] recipient has no registered device token")
    return { ok: false, transport: "none", error: "missing push token" }
  }
  try {
    if (isWebPushSubscription(pushToken)) {
      return await sendWebPush(pushToken, title, body, href)
    }
    return await sendFcm(pushToken, title, body, href)
  } catch (error) {
    console.error("[PUSH ERROR]", error)
    return {
      ok: false,
      transport: "none",
      error: error instanceof Error ? error.message : String(error),
    }
  }
}

// Backwards-compatible alias for callers importing { sendFcm }.
export { sendFcm }
