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

  if (input.pushToken) {
    await sendPush(input.pushToken, input.title, input.body, input.href)
  }

  return notification
}