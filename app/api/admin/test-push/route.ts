import { NextRequest, NextResponse } from "next/server"
import { prisma } from "@/lib/prisma"
import { isAdmin } from "@/lib/getAdmin"
import { sendPush } from "@/lib/sendPush"

export const dynamic = "force-dynamic"
export const maxDuration = 60

function tokenPreview(token: string): string {
  return token.length > 160 ? `${token.slice(0, 160)}… (${token.length} chars)` : token
}

// Admin-only diagnostics endpoint. Sends to the most recent DeviceToken so
// the exact push-service response shows up in the admin panel and Vercel logs.
// sendPush routes web-push subscriptions through VAPID and native tokens
// through Firebase Admin, so this one endpoint tests both transports.
export async function POST(req: NextRequest) {
  if (!isAdmin(req)) {
    return NextResponse.json({ error: "not authorized." }, { status: 403 })
  }

  const requestBody = (await req.json().catch(() => ({}))) as { platform?: unknown }
  const requestedPlatform =
    requestBody.platform === "android" ||
    requestBody.platform === "ios" ||
    requestBody.platform === "web-push"
      ? requestBody.platform
      : null

  const latest = await prisma.deviceToken.findFirst({
    where: requestedPlatform ? { platform: requestedPlatform } : undefined,
    orderBy: { createdAt: "desc" },
  })

  if (!latest) {
    return NextResponse.json(
      {
        error: requestedPlatform
          ? `No DeviceTokens found for platform "${requestedPlatform}" in DB`
          : "No DeviceTokens found in DB",
        requestedPlatform,
      },
      { status: 404 }
    )
  }

  console.info("[TEST PUSH] most recent DeviceToken", {
    id: latest.id,
    userId: latest.userId,
    platform: latest.platform,
    createdAt: latest.createdAt,
    token: latest.token,
  })

  const title = "yard test push"
  const pushBody = `push pipeline test — ${new Date().toISOString()}`
  const href = "/notifications"

  const result = await sendPush(latest.token, title, pushBody, href, latest.platform)

  return NextResponse.json(
    {
      requestedPlatform,
      deviceTokenId: latest.id,
      userId: latest.userId,
      platform: latest.platform,
      createdAt: latest.createdAt,
      tokenPreview: tokenPreview(latest.token),
      ok: result.ok,
      transport: result.transport,
      statusCode: result.statusCode ?? null,
      body: result.body ?? null,
      error: result.error ?? null,
      removed: result.removed ?? false,
      endpointHost: result.endpointHost ?? null,
    },
    { status: result.ok ? 200 : 500 }
  )
}
