import { NextRequest, NextResponse } from "next/server"
import webpush from "web-push"
import { prisma } from "@/lib/prisma"
import { isAdmin } from "@/lib/getAdmin"
import { isWebPushSubscription, sendPush } from "@/lib/sendPush"
import { getVapidConfig } from "@/lib/vapid"

export const dynamic = "force-dynamic"
export const maxDuration = 60

function tokenPreview(token: string): string {
  return token.length > 160 ? `${token.slice(0, 160)}… (${token.length} chars)` : token
}

// Admin-only diagnostics endpoint. Sends to the most recent DeviceToken so
// the exact push-service response shows up in the admin panel and Vercel logs.
export async function POST(req: NextRequest) {
  if (!isAdmin(req)) {
    return NextResponse.json({ error: "not authorized." }, { status: 403 })
  }

  const latest = await prisma.deviceToken.findFirst({
    orderBy: { createdAt: "desc" },
  })

  if (!latest) {
    return NextResponse.json({ error: "No DeviceTokens found in DB" }, { status: 404 })
  }

  console.info("[TEST PUSH] most recent DeviceToken", {
    id: latest.id,
    userId: latest.userId,
    platform: latest.platform,
    createdAt: latest.createdAt,
    token: latest.token,
  })

  const title = "yard test push"
  const body = `push pipeline test — ${new Date().toISOString()}`
  const href = "/notifications"
  const base = {
    deviceTokenId: latest.id,
    userId: latest.userId,
    platform: latest.platform,
    createdAt: latest.createdAt,
    tokenPreview: tokenPreview(latest.token),
  }

  if (isWebPushSubscription(latest.token)) {
    const config = getVapidConfig()
    if (!config.configured) {
      const message = config.warning || "VAPID keys are missing."
      console.error("[PUSH CONFIG]", message)
      return NextResponse.json(
        {
          ...base,
          ok: false,
          transport: "web-push",
          error: message,
          vapid: { configured: false, source: config.source },
        },
        { status: 500 }
      )
    }

    webpush.setVapidDetails("mailto:hello@yardapp.me", config.publicKey, config.privateKey)

    try {
      const subscription = JSON.parse(latest.token) as {
        endpoint: string
        keys?: { p256dh?: string; auth?: string }
      }
      const result = await webpush.sendNotification(
        subscription,
        JSON.stringify({ title, body, href, icon: "/icon-192.png" }),
        { TTL: 60 }
      )
      console.info("[TEST PUSH] push service accepted the notification", {
        deviceTokenId: latest.id,
        statusCode: result.statusCode,
      })
      return NextResponse.json({
        ...base,
        ok: true,
        transport: "web-push",
        statusCode: result.statusCode,
        body: result.body,
        headers: result.headers,
        vapid: { configured: true, source: config.source, warning: config.warning },
      })
    } catch (error: unknown) {
      const err = error as { statusCode?: number; body?: string; message?: string }
      // Exact error is deliberately returned to the admin UI and logged.
      console.error("[PUSH ERROR]", err.statusCode, err.body ?? err.message)

      let removed = false
      if (err.statusCode === 404 || err.statusCode === 410) {
        await prisma.deviceToken.deleteMany({ where: { token: latest.token } })
        await prisma.user.updateMany({ where: { pushToken: latest.token }, data: { pushToken: null } })
        removed = true
        console.error("[PUSH ERROR] removed dead DeviceToken", latest.id, `(${err.statusCode})`)
      }

      return NextResponse.json(
        {
          ...base,
          ok: false,
          transport: "web-push",
          statusCode: err.statusCode ?? null,
          body: err.body ?? null,
          error: err.message || "webpush.sendNotification failed.",
          removed,
          vapid: { configured: true, source: config.source, warning: config.warning },
        },
        { status: 500 }
      )
    }
  }

  // Native Android/iOS token: use the FCM transport and return the same
  // status/body detail the web-push branch returns.
  const result = await sendPush(latest.token, title, body, href)
  return NextResponse.json(
    {
      ...base,
      ok: result.ok,
      transport: result.transport,
      statusCode: result.statusCode ?? null,
      body: result.body ?? null,
      error: result.error ?? null,
      removed: result.removed ?? false,
    },
    { status: result.ok ? 200 : 500 }
  )
}
