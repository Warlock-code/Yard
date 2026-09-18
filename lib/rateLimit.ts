import { prisma } from "@/lib/prisma"

export async function rateLimit(key: string, max: number, windowMs: number) {
  const now = new Date()
  const windowStart = new Date(now.getTime() - windowMs)

  const record = await prisma.rateLimit.upsert({
    where: { key },
    create: {
      key,
      hits: 1,
      windowStart: now,
      expiresAt: new Date(now.getTime() + windowMs),
    },
    update: {
      hits: { increment: 1 },
      windowStart: now,
      expiresAt: new Date(now.getTime() + windowMs),
    },
  })

  if (record.hits > max) {
    return false
  }

  await prisma.rateLimit.deleteMany({
    where: { expiresAt: { lt: now } },
  })

  return true
}