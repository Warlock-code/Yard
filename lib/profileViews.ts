import { prisma } from "@/lib/prisma"

// Who-viewed ledger writer. Best-effort, never throws. Self-views skipped,
// one row per viewer per viewed per day. Lives here (not in the route file)
// because Next.js route modules may only export HTTP handlers.
export async function recordProfileView(viewerId: string, viewedId: string) {
  try {
    if (!viewerId || !viewedId || viewerId === viewedId) return
    const dayStart = new Date()
    dayStart.setHours(0, 0, 0, 0)
    const existing = await prisma.profileView.findFirst({
      where: { viewerId, viewedId, createdAt: { gte: dayStart } },
      select: { id: true },
    })
    if (existing) return
    await prisma.profileView.create({ data: { viewerId, viewedId } })
  } catch {
    // table missing pre-migration — ignore
  }
}
