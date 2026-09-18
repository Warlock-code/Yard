import { NextRequest, NextResponse } from "next/server"
import { prisma } from "@/lib/prisma"
import { getCurrentUser } from "@/lib/getCurrentUser"

export async function POST(req: NextRequest) {
  const user = await getCurrentUser(req)
  if (!user) return NextResponse.json({ error: "Not authenticated." }, { status: 401 })

  const { promptId, text } = await req.json()
  if (typeof promptId !== "string" || typeof text !== "string" || !text.trim()) return NextResponse.json({ error: "Entry can't be empty." }, { status: 400 })
  if (text.trim().length > 500) return NextResponse.json({ error: "Entries must be 500 characters or fewer." }, { status: 400 })

  const prompt = await prisma.battlePrompt.findUnique({ where: { id: promptId } })
  const now = new Date()
  if (!prompt || prompt.campus !== user.campus || !prompt.active || prompt.startsAt > now || prompt.endsAt <= now) {
    return NextResponse.json({ error: "This battle has ended." }, { status: 400 })
  }

  let entry
  try {
    entry = await prisma.battleEntry.create({
      data: {
        promptId,
        userId: user.id,
        text: text.trim(),
        campus: user.campus,
        isPrime: user.tier === "PRIME",
      },
    })
  } catch (error: unknown) {
    if (typeof error === "object" && error !== null && "code" in error && error.code === "P2002") {
      return NextResponse.json({ error: "You already entered this battle." }, { status: 409 })
    }
    throw error
  }

  return NextResponse.json({ entry })
}
