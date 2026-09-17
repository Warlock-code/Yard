import { NextRequest, NextResponse } from "next/server"
import { prisma } from "@/lib/prisma"
import { isAdmin } from "@/lib/getAdmin"

const VALID_CAMPUSES = ["University of Ghana", "KNUST", "UCC", "GCTU", "UPSA"]

export async function POST(req: NextRequest) {
  if (!isAdmin(req)) {
    return NextResponse.json({ error: "Not authorized." }, { status: 403 })
  }

  const { text, campus, durationHours } = await req.json()
  if (!text?.trim() || !campus) {
    return NextResponse.json({ error: "Prompt text and campus required." }, { status: 400 })
  }
  if (!VALID_CAMPUSES.includes(campus)) {
    return NextResponse.json({ error: "Invalid campus." }, { status: 400 })
  }

  await prisma.battlePrompt.updateMany({
    where: { campus, active: true },
    data: { active: false },
  })

  const prompt = await prisma.battlePrompt.create({
    data: {
      text,
      campus,
      active: true,
      endsAt: new Date(Date.now() + (durationHours || 24 * 7) * 60 * 60 * 1000),
    },
  })

  return NextResponse.json({ prompt })
}