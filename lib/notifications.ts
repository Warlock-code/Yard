import { prisma } from "@/lib/prisma"
import { sendPush } from "@/lib/sendPush"

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
  const tokens = new Set([
    ...(recipient?.deviceTokens.map((device) => device.token) || []),
    recipient?.pushToken,
    input.pushToken,
  ].filter((token): token is string => Boolean(token)))

  for (const token of tokens) {
    await sendPush(token, input.title, input.body, input.href)
  }

  return notification
}