import { NextRequest, NextResponse } from "next/server"
import { prisma } from "@/lib/prisma"
import { isAdmin } from "@/lib/getAdmin"
import { sendPush } from "@/lib/sendPush"

export const dynamic = "force-dynamic"
export const maxDuration = 300

const TYPE = "admin_broadcast"
const ALLOWED_TYPES = new Set(["admin_broadcast", "invite_contest"])
const DEFAULT_LIMIT = 100
const MAX_LIMIT = 200
const PUSH_CONCURRENCY = 10

function validHref(href: unknown): href is string {
  if (typeof href !== "string" || !href || href.length > 512) return false
  if (href.startsWith("javascript:")) return false
  return href.startsWith("/") || href.startsWith("https://")
}

async function pool<T>(items: T[], size: number, fn: (item: T) => Promise<void>) {
  for (let i = 0; i < items.length; i += size) {
    await Promise.allSettled(items.slice(i, i + size).map(fn))
  }
}

// Chunked broadcast: each call handles up to `limit` users and returns a
// cursor. The admin UI loops until done, so no request times out even with
// thousands of users. Safe to retry — users already notified are skipped.
export async function POST(req: NextRequest) {
  if (!isAdmin(req)) return NextResponse.json({ error: "not authorized." }, { status: 403 })

  const { title: rawTitle, body: rawBody, href: rawHref, cursor, limit: rawLimit, type: rawType } = await req.json()
  const title = typeof rawTitle === "string" ? rawTitle.trim() : ""
  const body = typeof rawBody === "string" ? rawBody.trim() : ""
  const type = typeof rawType === "string" && ALLOWED_TYPES.has(rawType) ? rawType : TYPE
  if (!title || title.length > 80) {
    return NextResponse.json({ error: "title is required (80 chars max)." }, { status: 400 })
  }
  if (!body || body.length > 200) {
    return NextResponse.json({ error: "message is required (200 chars max)." }, { status: 400 })
  }
  if (!validHref(rawHref)) {
    return NextResponse.json({ error: "link must be an in-app path (e.g. /download) or https url." }, { status: 400 })
  }
  const href = rawHref as string
  const limit = Math.min(Math.max(Number(rawLimit) || DEFAULT_LIMIT, 1), MAX_LIMIT)

  const chunk = await prisma.user.findMany({
    where: cursor ? { id: { gt: String(cursor) } } : undefined,
    orderBy: { id: "asc" },
    take: limit + 1,
    select: {
      id: true,
      pushToken: true,
      deviceTokens: { select: { token: true, platform: true } },
    },
  })
  const done = chunk.length <= limit
  const users = done ? chunk : chunk.slice(0, limit)
  const nextCursor = done ? null : users[users.length - 1]?.id ?? null

  if (users.length === 0) return NextResponse.json({ sent: 0, pushed: 0, done: true, nextCursor: null })

  const ids = users.map((u) => u.id)
  const already = await prisma.notification.findMany({
    where: { userId: { in: ids }, type, title },
    select: { userId: true },
  })
  const notified = new Set(already.map((n) => n.userId))
  const pending = users.filter((u) => !notified.has(u.id))

  if (pending.length > 0) {
    await prisma.notification.createMany({
      data: pending.map((u) => ({ userId: u.id, type, title, body, href })),
    })
  }

  const pushes: { token: string; platform: string | null }[] = []
  for (const u of pending) {
    const devices = new Map<string, string | null>()
    for (const device of u.deviceTokens) devices.set(device.token, device.platform)
    if (u.pushToken && !devices.has(u.pushToken)) devices.set(u.pushToken, null)
    for (const [token, platform] of devices) pushes.push({ token, platform })
  }
  let pushed = 0
  await pool(pushes, PUSH_CONCURRENCY, async ({ token, platform }) => {
    await sendPush(token, title, body, href, platform)
    pushed += 1
  })

  return NextResponse.json({ sent: pending.length, pushed, done, nextCursor })
}
