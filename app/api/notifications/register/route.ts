import { NextRequest, NextResponse } from "next/server"
import { prisma } from "@/lib/prisma"
import { getCurrentUser } from "@/lib/getCurrentUser"
import { isWebPushSubscription } from "@/lib/sendPush"

export async function POST(req: NextRequest) {
  const user = await getCurrentUser(req)
  if (!user) return NextResponse.json({ error: "not authenticated." }, { status: 401 })

  let rawBody: unknown
  try {
    rawBody = await req.json()
  } catch {
    return NextResponse.json({ error: "a push token is required." }, { status: 400 })
  }
  const body = (rawBody ?? {}) as { token?: unknown; subscription?: unknown; platform?: unknown }

  // Accept BOTH transports:
  // - Web Push: JSON subscription, either as a stringified JSON string in
  //   `token`, as an object in `token`, as `subscription`, or as the raw
  //   POST body itself (a PushSubscription-like { endpoint, keys } object).
  // - Android FCM: opaque string in `token`.
  let candidate: unknown = body.token ?? body.subscription ?? null
  if (candidate == null && typeof body === "object" && body !== null) {
    const maybe = body as { endpoint?: unknown; keys?: unknown }
    if (typeof maybe.endpoint === "string") candidate = body
  }
  let token: string
  if (typeof candidate === "string") {
    token = candidate
  } else if (candidate !== null && typeof candidate === "object") {
    try {
      token = JSON.stringify(candidate)
    } catch {
      return NextResponse.json({ error: "a push token is required." }, { status: 400 })
    }
  } else {
    return NextResponse.json({ error: "a push token is required." }, { status: 400 })
  }
  if (!token.trim()) {
    return NextResponse.json({ error: "a push token is required." }, { status: 400 })
  }
  if (token.length > 4096) {
    return NextResponse.json({ error: "push token is too long." }, { status: 400 })
  }

  const platform = body.platform

  // Web Push subscriptions are JSON blobs; native (Android/iOS) tokens are
  // opaque strings. Storing the right platform keeps the sender from pushing
  // a browser subscription through FCM (which always fails).
  const resolvedPlatform =
    platform === "web-push" || platform === "android" || platform === "ios"
      ? platform
      : isWebPushSubscription(token)
        ? "web-push"
        : "android"

  if (resolvedPlatform === "web-push") {
    try {
      const parsed = JSON.parse(token) as { endpoint?: unknown; keys?: { p256dh?: unknown; auth?: unknown } }
      if (
        typeof parsed.endpoint !== "string" ||
        !parsed.endpoint.startsWith("https://") ||
        typeof parsed.keys?.p256dh !== "string" ||
        typeof parsed.keys?.auth !== "string"
      ) {
        console.error("[PUSH REGISTER] rejected malformed web-push subscription", {
          userId: user.id,
          tokenChars: token.length,
        })
        return NextResponse.json({ error: "invalid web push subscription." }, { status: 400 })
      }
    } catch {
      console.error("[PUSH REGISTER] rejected unparseable web-push subscription", {
        userId: user.id,
        tokenChars: token.length,
      })
      return NextResponse.json({ error: "invalid web push subscription." }, { status: 400 })
    }
  }

  try {
    await prisma.deviceToken.upsert({
      where: { token },
      update: { userId: user.id, platform: resolvedPlatform },
      create: { userId: user.id, token, platform: resolvedPlatform },
    })
    await prisma.user.update({ where: { id: user.id }, data: { pushToken: token } })
  } catch (error) {
    console.error("[PUSH REGISTER] failed to save DeviceToken", {
      userId: user.id,
      platform: resolvedPlatform,
      tokenChars: token.length,
    }, error)
    return NextResponse.json({ error: "could not save push subscription." }, { status: 500 })
  }

  console.info("[PUSH REGISTER] saved", {
    userId: user.id,
    platform: resolvedPlatform,
    tokenChars: token.length,
  })

  return NextResponse.json({ success: true })
}
