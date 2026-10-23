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

type MentionAudience = {
  visibility?: string | null
  programKey?: string | null
}

export async function notifyMentions({
  text,
  senderUser,
  href,
  excludeUserId,
  audience,
}: {
  text: string
  senderUser: SenderUser
  href: string
  excludeUserId?: string | null
  audience?: MentionAudience
}) {
  try {
    const handles = extractMentionHandles(text)
    if (handles.length === 0) return

    // A mention on a class post must not notify (or push the post text to)
    // someone outside that class. Legacy class posts without a programKey
    // get no mention delivery rather than a campus-wide leak.
    const classAudience = audience?.visibility === "program"
    const users = await prisma.user.findMany({
      where: {
        ghostId: { in: handles },
        status: "ACTIVE",
        ...(classAudience ? { programKey: audience?.programKey || "__no_class__" } : {}),
      },
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
