import { prisma } from "@/lib/prisma"
import { createNotification } from "@/lib/notifications"

export const MENTION_REGEX = /@([A-Za-z0-9_]{2,30})/g

export function extractMentionHandles(text: string): string[] {
  const handles = new Set<string>()
  for (const match of text.matchAll(MENTION_REGEX)) {
    handles.add(match[1])
  }
  return [...handles]
}

type SenderUser = {
  id: string
  ghostId: string
  pushToken?: string | null
}

export async function notifyMentions({
  text,
  senderUser,
  href,
  excludeUserId,
}: {
  text: string
  senderUser: SenderUser
  href: string
  excludeUserId?: string | null
}) {
  try {
    const handles = extractMentionHandles(text)
    if (handles.length === 0) return

    const users = await prisma.user.findMany({
      where: { ghostId: { in: handles } },
      select: { id: true, ghostId: true, pushToken: true },
    })

    const seen = new Set<string>()
    for (const user of users) {
      if (seen.has(user.id)) continue
      seen.add(user.id)
      if (user.id === senderUser.id) continue
      if (excludeUserId && user.id === excludeUserId) continue

      await createNotification({
        userId: user.id,
        pushToken: user.pushToken,
        type: "mention",
        title: `${senderUser.ghostId} mentioned you`,
        body: text.slice(0, 120),
        href,
        actorName: senderUser.ghostId,
      })
    }
  } catch (error) {
    console.error("Failed to notify mentions:", error)
  }
}
