import { prisma } from "@/lib/prisma"
import { sendPush } from "@/lib/sendPush"
import { canReadPost } from "@/lib/program"
import { emitNotification } from "@/server/socket"

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

  for (const token of tokens) {
    await sendPush(token, input.title, input.body, input.href)
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