import { NextRequest, NextResponse } from "next/server"
import { prisma } from "@/lib/prisma"
import { getCurrentUser } from "@/lib/getCurrentUser"
import { isWebPushSubscription } from "@/lib/sendPush"

export async function POST(req: NextRequest) {
  const user = await getCurrentUser(req)
  if (!user) return NextResponse.json({ error: "not authenticated." }, { status: 401 })

  const { token, platform } = await req.json()
  if (typeof token !== "string" || !token.trim()) {
    return NextResponse.json({ error: "a push token is required." }, { status: 400 })
  }
  if (token.length > 4096) {
    return NextResponse.json({ error: "push token is too long." }, { status: 400 })
  }

  // Web Push subscriptions are JSON blobs; native (Android/iOS) tokens are
  // opaque strings. Storing the right platform keeps the sender from pushing
  // a browser subscription through FCM (which always fails).
  const resolvedPlatform =
    platform === "web-push" || platform === "android" || platform === "ios"
      ? platform
      : isWebPushSubscription(token)
        ? "web-push"
        : "android"

  await prisma.deviceToken.upsert({
    where: { token },
    update: { userId: user.id, platform: resolvedPlatform },
    create: { userId: user.id, token, platform: resolvedPlatform },
  })
  await prisma.user.update({ where: { id: user.id }, data: { pushToken: token } })
  console.info("Push token registered", { userId: user.id, platform: resolvedPlatform })

  return NextResponse.json({ success: true })
}