import { prisma } from "@/lib/prisma"
import { sendPush } from "@/lib/sendPush"
import { canReadPost } from "@/lib/program"
import { emitNotification } from "@/lib/socket-client"

type NotificationInput = {
  userId: string
  pushToken?: string | null
  type: string
  title: string
  body: string
  href: string
  actorName?: string
}

export async function createNotification(input: NotificationInput) {
  if (input.href.startsWith("/post/")) {
    const postId = input.href.slice("/post/".length).split(/[?#]/u)[0]
    const [viewer, post] = await Promise.all([
      prisma.user.findUnique({ where: { id: input.userId }, select: { campus: true, program: true } }),
      prisma.post.findUnique({ where: { id: postId } }),
    ])
    if (!viewer || !post || !canReadPost(viewer, post)) return null
  }

  const notification = await prisma.notification.create({
    data: {
      userId: input.userId,
      type: input.type,
      title: input.title,
      body: input.body,
      href: input.href,
      actorName: input.actorName,
    },
  })

  const recipient = await prisma.user.findUnique({
    where: { id: input.userId },
    select: {
      pushToken: true,
      deviceTokens: { select: { token: true } },
    },
  })

  const tokens = new Set(
    [
      ...(recipient?.deviceTokens.map((device) => device.token) || []),
      recipient?.pushToken,
      input.pushToken,
    ].filter((token): token is string => Boolean(token))
  )

  // Fan out to every registered transport for this user. Web Push
  // subscriptions are routed through webpush.sendNotification inside
  // sendPush; native FCM tokens go through FCM. A failed device never blocks
  // the rest of the fan-out or the in-app notification.
  const pushResults = await Promise.allSettled(
    [...tokens].map((token) => sendPush(token, input.title, input.body, input.href))
  )

  // Never silently swallow a failed fan-out: the transport logs the exact
  // status/body, and this catches anything that escaped it.
  for (const result of pushResults) {
    if (result.status === "rejected") {
      console.error("[PUSH ERROR] notification fan-out rejected", result.reason)
    } else if (!result.value.ok) {
      console.error("[PUSH ERROR] notification fan-out failed", {
        type: input.type,
        transport: result.value.transport,
        statusCode: result.value.statusCode,
        body: result.value.body,
        error: result.value.error,
      })
    }
  }

 emitNotification(input.userId, {
  id: notification.id,
  type: notification.type,
  title: notification.title,
  body: notification.body,
  href: notification.href,
  actorName: notification.actorName || undefined,
  readAt: notification.readAt ? notification.readAt.toISOString() : null,
  createdAt: notification.createdAt.toISOString(),
})

  return notification
}

// Backwards-compatible alias: createAndPush === createNotification
// (inbox row + push to ALL deviceTokens + pushToken + socket).
export const createAndPush = createNotification