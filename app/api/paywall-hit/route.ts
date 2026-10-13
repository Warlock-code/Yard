import { NextRequest, NextResponse } from "next/server"
import { prisma } from "@/lib/prisma"
import { getCurrentUser } from "@/lib/getCurrentUser"

const ALLOWED_FEATURES = new Set([
  "trending",
  "analytics",
  "battle",
  "edit",
  "boost",
  "upgrade_view",
  "other",
])

export async function POST(req: NextRequest) {
  let body: unknown
  try {
    body = await req.json()
  } catch {
    return NextResponse.json({ error: "invalid JSON." }, { status: 400 })
  }

  const feature =
    typeof body === "object" && body !== null
      ? (body as Record<string, unknown>).feature
      : undefined
  const pathname =
    typeof body === "object" && body !== null
      ? (body as Record<string, unknown>).pathname
      : undefined

  if (typeof feature !== "string" || !ALLOWED_FEATURES.has(feature)) {
    return NextResponse.json({ error: "invalid feature." }, { status: 400 })
  }

  let userId: string | null = null
  try {
    const user = await getCurrentUser(req)
    userId = user?.id ?? null
  } catch {
    userId = null
  }

  const cleanPathname =
    typeof pathname === "string" ? pathname.slice(0, 500) : undefined

  await prisma.paywallHit.create({
    data: {
      userId,
      feature,
      pathname: cleanPathname,
    },
  })

  // Analytics beacon — live-safe, never breaks the main flow.
  try {
    await prisma.analyticsEvent.create({
      data: { userId, type: "paywall_hit", pathname: cleanPathname ?? null, metadata: { feature } },
    }).catch(() => {})
  } catch {}

  return NextResponse.json({ ok: true })
}
