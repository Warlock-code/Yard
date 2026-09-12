import { NextRequest, NextResponse } from "next/server"
import { prisma } from "@/lib/prisma"
import { getCurrentUser } from "@/lib/getCurrentUser"

export async function GET(req: NextRequest) {
  const user = await getCurrentUser(req)
  if (!user) return NextResponse.json({ error: "Not authenticated." }, { status: 401 })

  const prompt = await prisma.battlePrompt.findFirst({
    where: { campus: user.campus, active: true, endsAt: { gt: new Date() } },
    orderBy: { startsAt: "desc" },
  })

  if (!prompt) return NextResponse.json({ prompt: null, entries: [] })

  const entries = await prisma.battleEntry.findMany({
    where: { promptId: prompt.id, campus: user.campus },
    orderBy: { votes: "desc" },
    include: { user: { select: { ghostId: true, avatarEmoji: true, tier: true } } },
  })

  return NextResponse.json({ prompt, entries })
}