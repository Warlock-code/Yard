import { cert, getApps, initializeApp, type App } from "firebase-admin/app"
import { getMessaging, type Message } from "firebase-admin/messaging"
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

let firebaseApp: App | null | undefined
let firebaseInitError: string | null = null

function errorText(error: unknown): string {
  if (error instanceof Error) return `${error.name}: ${error.message}`
  return String(error)
}

function envValue(name: string): string {
  return (process.env[name] || "").trim().replace(/^["']|["']$/g, "")
}

function normalizePrivateKey(value: string): string {
  return value.replace(/\\n/g, "\n")
}

function getServiceAccountFromJson(): FirebaseServiceAccount | null {
  const raw = process.env.FIREBASE_SERVICE_ACCOUNT?.trim()
  if (!raw) return null

  try {
    const unwrapped = raw.replace(/^'([\s\S]*)'$/, "$1").replace(/^\"([\s\S]*)\"$/, "$1")
    const key = JSON.parse(unwrapped) as FirebaseServiceAccount
    if (!key.project_id || !key.client_email || !key.private_key) {
      throw new Error("Incomplete Firebase service account")
    }
    return {
      project_id: key.project_id,
      client_email: key.client_email,
      private_key: normalizePrivateKey(key.private_key),
    }
  } catch (error) {
    firebaseInitError = `invalid FIREBASE_SERVICE_ACCOUNT: ${errorText(error)}`
    console.error("[PUSH CONFIG] FCM is not configured: invalid FIREBASE_SERVICE_ACCOUNT", error)
    return null
  }
}

/**
 * Firebase Admin is initialized lazily so importing this module never crashes a
 * route that only uses web push. Supports both the requested split env vars and
 * the legacy single-JSON FIREBASE_SERVICE_ACCOUNT value.
 */
function getFirebaseApp(): App | null {
  if (firebaseApp !== undefined) return firebaseApp

  const existing = getApps()
  if (existing.length > 0) {
    firebaseApp = existing[0]
    firebaseInitError = null
    return firebaseApp
  }

  firebaseInitError = null

  // Prefer the single JSON service account: it is the credential that was
  // already working in production before the split-env support was added.
  // If it is missing or invalid, fall through to the split env vars.
  const serviceAccount = getServiceAccountFromJson()
  if (serviceAccount) {
    try {
      firebaseApp = initializeApp({
        credential: cert({
          projectId: serviceAccount.project_id,
          clientEmail: serviceAccount.client_email,
          privateKey: serviceAccount.private_key,
        }),
        projectId: serviceAccount.project_id,
      })
      firebaseInitError = null
      console.info("[PUSH CONFIG] Firebase Admin initialized from FIREBASE_SERVICE_ACCOUNT", {
        projectId: serviceAccount.project_id,
      })
      return firebaseApp
    } catch (error) {
      const message = `failed to initialize Firebase Admin from FIREBASE_SERVICE_ACCOUNT: ${errorText(error)}`
      firebaseInitError = firebaseInitError ? `${firebaseInitError}; ${message}` : message
      console.error(
        "[PUSH CONFIG] failed to initialize Firebase Admin from FIREBASE_SERVICE_ACCOUNT; trying split env vars",
        error
      )
    }
  }

  const projectId = envValue("FIREBASE_PROJECT_ID")
  const clientEmail = envValue("FIREBASE_CLIENT_EMAIL")
  const privateKey = normalizePrivateKey(envValue("FIREBASE_PRIVATE_KEY"))

  if (projectId && clientEmail && privateKey) {
    try {
      firebaseApp = initializeApp({
        credential: cert({ projectId, clientEmail, privateKey }),
        projectId,
      })
      firebaseInitError = null
      console.info("[PUSH CONFIG] Firebase Admin initialized from split env vars", { projectId })
      return firebaseApp
    } catch (error) {
      const message = `failed to initialize Firebase Admin from split env vars: ${errorText(error)}`
      firebaseInitError = firebaseInitError ? `${firebaseInitError}; ${message}` : message
      console.error("[PUSH CONFIG] failed to initialize Firebase Admin from split env vars", error)
    }
  }

  const missing = [
    !projectId ? "FIREBASE_PROJECT_ID" : null,
    !clientEmail ? "FIREBASE_CLIENT_EMAIL" : null,
    !privateKey ? "FIREBASE_PRIVATE_KEY" : null,
  ].filter(Boolean)
  if (!firebaseInitError) {
    firebaseInitError = `FCM is not configured. Set FIREBASE_SERVICE_ACCOUNT or all of: ${
      missing.join(", ") || "FIREBASE_PROJECT_ID, FIREBASE_CLIENT_EMAIL, FIREBASE_PRIVATE_KEY"
    }`
  }
  console.error(
    "[PUSH CONFIG] FCM is not configured. Set FIREBASE_SERVICE_ACCOUNT or all of:",
    missing.join(", ") || "FIREBASE_PROJECT_ID, FIREBASE_CLIENT_EMAIL, FIREBASE_PRIVATE_KEY",
    firebaseInitError
  )
  firebaseApp = null
  return null
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

function isDeadFcmToken(code: string, message: string): boolean {
  return (
    code === "messaging/registration-token-not-registered" ||
    code === "messaging/invalid-registration-token" ||
    message.includes("Requested entity was not found") ||
    message.includes("UNREGISTERED")
  )
}

function fcmStatusCode(code: string): number {
  switch (code) {
    case "messaging/registration-token-not-registered":
    case "messaging/invalid-registration-token":
      return 404
    case "messaging/mismatched-credential":
    case "messaging/authentication-error":
      return 401
    case "messaging/invalid-argument":
      return 400
    case "messaging/quota-exceeded":
      return 429
    case "messaging/server-unavailable":
      return 503
    default:
      return 500
  }
}

export async function sendFcm(
  pushToken: string,
  title: string,
  body: string,
  href?: string,
  platform?: string | null
): Promise<PushSendResult> {
  const app = getFirebaseApp()
  if (!app) {
    return {
      ok: false,
      transport: "fcm",
      error:
        firebaseInitError ||
        "FCM is not configured. Set FIREBASE_PROJECT_ID, FIREBASE_CLIENT_EMAIL and FIREBASE_PRIVATE_KEY (or FIREBASE_SERVICE_ACCOUNT).",
    }
  }

  const isIos = platform === "ios"
  const message: Message = {
    token: pushToken,
    notification: { title, body },
    // Always include a click target. A bare notification payload is enough
    // for the banner, but the app needs this to open the relevant screen.
    data: { href: href || "/" },
    android: {
      priority: "high",
      notification: {
        channelId: "yard-v2",
        sound: "default",
      },
    },
    ...(isIos
      ? {
          apns: {
            payload: {
              aps: {
                sound: "default",
                badge: 1,
              },
            },
          },
        }
      : {}),
  }

  try {
    const messageId = await getMessaging(app).send(message)
    return {
      ok: true,
      transport: "fcm",
      statusCode: 200,
      body: messageId,
    }
  } catch (error: unknown) {
    const err = error as {
      code?: string
      message?: string
      errorInfo?: { code?: string; message?: string }
    }
    const code = err.code || err.errorInfo?.code || "messaging/unknown"
    const messageText = err.message || err.errorInfo?.message || String(error)
    console.error("[PUSH ERROR]", code, messageText)

    if (isDeadFcmToken(code, messageText)) {
      await deleteDeadToken(pushToken, `fcm ${code}`)
      return {
        ok: false,
        transport: "fcm",
        statusCode: 404,
        body: messageText,
        error: `${code}: ${messageText}`,
        removed: true,
      }
    }

    return {
      ok: false,
      transport: "fcm",
      statusCode: fcmStatusCode(code),
      body: messageText,
      error: `${code}: ${messageText}`,
    }
  }
}

// Route a stored token to the right transport. `platform` comes from the
// DeviceToken row; the JSON shape remains a fallback for legacy rows. Never
// throws: push must not break the notification/comment/vote flow.
export async function sendPush(
  pushToken: string,
  title: string,
  body: string,
  href?: string,
  platform?: string | null
): Promise<PushSendResult> {
  if (!pushToken) {
    console.error("[PUSH ERROR] recipient has no registered device token")
    return { ok: false, transport: "none", error: "missing push token" }
  }
  try {
    const normalizedPlatform = platform?.trim() || null
    const useWebPush = normalizedPlatform === "web-push" || isWebPushSubscription(pushToken)
    if (useWebPush) {
      return await sendWebPush(pushToken, title, body, href)
    }
    return await sendFcm(pushToken, title, body, href, normalizedPlatform)
  } catch (error) {
    console.error("[PUSH ERROR]", error)
    return {
      ok: false,
      transport: "none",
      error: error instanceof Error ? error.message : String(error),
    }
  }
}
