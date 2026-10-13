import { NextRequest, NextResponse } from "next/server"
import { prisma } from "@/lib/prisma"
import { getCurrentUser } from "@/lib/getCurrentUser"
import {
  creditUser,
  toCreditErrorResponse,
  trackFeatureEvent,
  CREDIT_CONFIG,
} from "@/lib/credits"

export const dynamic = "force-dynamic"

const POLL_MS = 48 * 60 * 60 * 1000
const MAX_OPTIONS = 4

// Anonymous polls — create for 100cr, voting is free. Everything public +
// reportable, ghost names only, never identities.
export async function GET(req: NextRequest) {
  const user = await getCurrentUser(req)
  if (!user) return NextResponse.json({ error: "not authenticated." }, { status: 401 })

  try {
    const polls = await prisma.poll.findMany({
      where: { campus: user.campus, endsAt: { gt: new Date() } },
      orderBy: { createdAt: "desc" },
      take: 20,
      include: { votes: { select: { optionIdx: true, userId: true } } },
    })
    return NextResponse.json({
      polls: polls.map((p) => {
        const options = (Array.isArray(p.options) ? p.options : []).map((o) => String(o))
        const counts = options.map((_, i) => p.votes.filter((v) => v.optionIdx === i).length)
        return {
          id: p.id,
          question: p.question,
          options,
          counts,
          total: p.votes.length,
          endsAt: p.endsAt,
          createdAt: p.createdAt,
          voted: p.votes.some((v) => v.userId === user.id) ? true : undefined,
        }
      }),
    })
  } catch {
    return NextResponse.json({ polls: [] })
  }
}

export async function POST(req: NextRequest) {
  const user = await getCurrentUser(req)
  if (!user) return NextResponse.json({ error: "not authenticated." }, { status: 401 })

  const body = await req.json().catch(() => ({}))
  const question = typeof body.question === "string" ? body.question.trim().toLowerCase() : ""
  const rawOptions: unknown[] = Array.isArray(body.options) ? body.options : []
  const options = rawOptions
    .filter((o: unknown): o is string => typeof o === "string" && o.trim().length > 0)
    .map((o: string) => o.trim().toLowerCase().slice(0, 80))
    .slice(0, MAX_OPTIONS)

  if (!question) return NextResponse.json({ error: "poll question required." }, { status: 400 })
  if (question.length > 200) return NextResponse.json({ error: "question must be 200 characters or fewer." }, { status: 400 })
  if (options.length < 2) return NextResponse.json({ error: "give at least 2 options." }, { status: 400 })

  try {
    await creditUser(user.id, "POLL_CREATE", -CREDIT_CONFIG.SPEND.POLL_CREATE, `poll_${user.id}_${Date.now()}`, {
      campus: user.campus,
    })
  } catch (err) {
    return toCreditErrorResponse(err, "polls cost 100cr to create.")
  }

  try {
    const poll = await prisma.poll.create({
      data: {
        userId: user.id,
        campus: user.campus,
        question,
        options,
        endsAt: new Date(Date.now() + POLL_MS),
      },
    })
    await trackFeatureEvent({ userId: user.id, type: "poll_create", metadata: { pollId: poll.id } })
    return NextResponse.json({ poll })
  } catch {
    await creditUser(user.id, "POLL_CREATE", CREDIT_CONFIG.SPEND.POLL_CREATE, `poll_${user.id}_${Date.now()}_refund`, {
      refund: true,
    }).catch(() => {})
    return NextResponse.json({ error: "couldn't create the poll. try again." }, { status: 500 })
  }
}
