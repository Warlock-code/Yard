import { NextRequest, NextResponse } from "next/server"
import { prisma } from "@/lib/prisma"
import { getCurrentUser } from "@/lib/getCurrentUser"

export const dynamic = "force-dynamic"

export async function POST(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const user = await getCurrentUser(req)
  if (!user) return NextResponse.json({ error: "not authenticated." }, { status: 401 })

  const { id } = await params
  try {
    const claimed = await prisma.askQuestion.updateMany({
      where: { id, recipientId: user.id, status: "pending" },
      data: { status: "dismissed" },
    })
    if (claimed.count !== 1) return NextResponse.json({ error: "already handled." }, { status: 400 })
  } catch {
    return NextResponse.json({ error: "ask is updating — try again in a bit." }, { status: 503 })
  }
  return NextResponse.json({ success: true })
}
