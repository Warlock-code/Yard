import { NextRequest, NextResponse } from "next/server"
import { prisma } from "@/lib/prisma"
import { getCurrentUser } from "@/lib/getCurrentUser"
import { trackFeatureEvent } from "@/lib/credits"

export const dynamic = "force-dynamic"

// Poll voting is always free — the creator already paid.
export async function POST(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params
  const user = await getCurrentUser(req)
  if (!user) return NextResponse.json({ error: "not authenticated." }, { status: 401 })

  const body = await req.json().catch(() => ({}))
  const optionIdx = typeof body.optionIdx === "number" ? Math.floor(body.optionIdx) : -1

  try {
    const poll = await prisma.poll.findUnique({ where: { id } })
    if (!poll || poll.campus !== user.campus || poll.endsAt <= new Date()) {
      return NextResponse.json({ error: "poll not found." }, { status: 404 })
    }
    const options = Array.isArray(poll.options) ? poll.options : []
    if (optionIdx < 0 || optionIdx >= options.length) {
      return NextResponse.json({ error: "invalid option." }, { status: 400 })
    }
    try {
      await prisma.pollVote.create({ data: { pollId: id, userId: user.id, optionIdx } })
    } catch (err: unknown) {
      if (typeof err === "object" && err !== null && "code" in err && err.code === "P2002") {
        return NextResponse.json({ error: "you already voted in this poll." }, { status: 400 })
      }
      throw err
    }
    await trackFeatureEvent({ userId: user.id, type: "poll_vote", metadata: { pollId: id } })
    return NextResponse.json({ success: true })
  } catch (err) {
    if (err instanceof Error && err.message.startsWith("you already")) {
      return NextResponse.json({ error: err.message }, { status: 400 })
    }
    return NextResponse.json({ polls: [], error: "polls unavailable right now." }, { status: 503 })
  }
}
