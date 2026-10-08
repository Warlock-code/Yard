import { NextRequest, NextResponse } from "next/server"
import { prisma } from "@/lib/prisma"
import { getCurrentUser } from "@/lib/getCurrentUser"
import { rateLimit } from "@/lib/rateLimit"

export const dynamic = "force-dynamic"

const MAX_LEN = 280

// NGL-style anonymous question. No login required (that's the viral loop).
// Fail-open reads: works before the AskQuestion migration is deployed.
export async function POST(req: NextRequest) {
  const body = await req.json().catch(() => ({}))
  const code = typeof body.code === "string" ? body.code.trim().toUpperCase() : ""
  const rawText = typeof body.text === "string" ? body.text.trim().toLowerCase() : ""

  if (!code) return NextResponse.json({ error: "link is missing." }, { status: 400 })
  if (!rawText) return NextResponse.json({ error: "write something first." }, { status: 400 })
  if (rawText.length > MAX_LEN) {
    return NextResponse.json({ error: `keep it under ${MAX_LEN} characters.` }, { status: 400 })
  }

  let recipient: { id: string; status: string } | null = null
  try {
    recipient = await prisma.user.findUnique({
      where: { inviteCode: code },
      select: { id: true, status: true },
    })
  } catch {
    return NextResponse.json({ error: "ask is updating — try again in a bit." }, { status: 503 })
  }
  if (!recipient || recipient.status !== "ACTIVE") {
    return NextResponse.json({ error: "this link doesn't belong to anyone." }, { status: 404 })
  }

  // Throttle: 5 questions/hour per link per IP, 20/hour per IP overall.
  const ip =
    req.headers.get("x-forwarded-for")?.split(",")[0]?.trim() ||
    req.headers.get("x-real-ip") ||
    "unknown"
  try {
    const okLink = await rateLimit(`ask:${code}:${ip}`, 5, 60 * 60 * 1000)
    const okIp = await rateLimit(`ask:ip:${ip}`, 20, 60 * 60 * 1000)
    if (!okLink || !okIp) {
      return NextResponse.json({ error: "slow down — too many questions. try again later." }, { status: 429 })
    }
  } catch {}

  // Logged-in senders are linked (future hints + abuse handling).
  // Anonymous senders stay fully anonymous.
  let senderId: string | null = null
  try {
    const me = await getCurrentUser(req)
    if (me && me.id !== recipient.id) senderId = me.id
  } catch {}

  try {
    await prisma.askQuestion.create({
      data: { recipientId: recipient.id, text: rawText, senderId },
    })
  } catch {
    return NextResponse.json({ error: "ask is updating — try again in a bit." }, { status: 503 })
  }

  try {
    await prisma.notification.create({
      data: {
        userId: recipient.id,
        type: "ask",
        title: "someone asked you 👀",
        body: "a new anonymous question landed in your inbox.",
        href: "/lair",
      },
    })
  } catch {}

  return NextResponse.json({ success: true })
}
