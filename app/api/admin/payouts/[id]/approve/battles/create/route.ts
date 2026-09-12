import { NextRequest, NextResponse } from "next/server"
import { prisma } from "@/lib/prisma"
import { getCurrentUser } from "@/lib/getCurrentUser"

const ADMIN_EMAILS = [process.env.ADMIN_EMAIL || ""]

export async function POST(req: NextRequest) {
  const user = await getCurrentUser(req)
  if (!user || !ADMIN_EMAILS.includes(user.email)) {
    return NextResponse.json({ error: "Not authorized." }, { status: 403 })
  }

  const { text, campus, durationHours } = await req.json()
  if (!text?.trim() || !campus) {
    return NextResponse.json({ error: "Prompt text and campus required." }, { status: 400 })
  }

  // deactivate any current battle for this campus first
  await prisma.battlePrompt.updateMany({
    where: { campus, active: true },
    data: { active: false },
  })

  const prompt = await prisma.battlePrompt.create({
    data: {
      text,
      campus,
      active: true,
      endsAt: new Date(Date.now() + (durationHours || 24) * 60 * 60 * 1000),
    },
  })

  return NextResponse.json({ prompt })
}