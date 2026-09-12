import { NextRequest, NextResponse } from "next/server"
import { prisma } from "@/lib/prisma"
import { getCurrentUser } from "@/lib/getCurrentUser"

export async function POST(req: NextRequest) {
  const user = await getCurrentUser(req)
  if (!user) return NextResponse.json({ error: "Not authenticated." }, { status: 401 })

  const { promptId, text } = await req.json()
  if (!text?.trim()) return NextResponse.json({ error: "Entry can't be empty." }, { status: 400 })

  const prompt = await prisma.battlePrompt.findUnique({ where: { id: promptId } })
  if (!prompt || !prompt.active || prompt.endsAt < new Date()) {
    return NextResponse.json({ error: "This battle has ended." }, { status: 400 })
  }

  const entry = await prisma.battleEntry.create({
    data: {
      promptId,
      userId: user.id,
      text,
      campus: user.campus,
      isPrime: user.tier === "PRIME",
    },
  })

  return NextResponse.json({ entry })
}