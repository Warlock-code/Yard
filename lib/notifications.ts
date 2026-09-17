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
    select: { pushToken: true },
  })
  const pushToken = recipient?.pushToken || input.pushToken

  if (pushToken) {
    await sendPush(pushToken, input.title, input.body, input.href)
  }

  return notification
}