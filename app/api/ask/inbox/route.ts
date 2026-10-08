import { NextRequest, NextResponse } from "next/server"
import { prisma } from "@/lib/prisma"
import { getCurrentUser } from "@/lib/getCurrentUser"

export const dynamic = "force-dynamic"

// Own ask inbox: pending first, then answered. Empty before migration.
export async function GET(req: NextRequest) {
  const user = await getCurrentUser(req)
  if (!user) return NextResponse.json({ error: "not authenticated." }, { status: 401 })

  try {
    const questions = await prisma.askQuestion.findMany({
      where: { recipientId: user.id },
      orderBy: [{ status: "asc" }, { createdAt: "desc" }],
      take: 50,
    })
    return NextResponse.json({ questions })
  } catch {
    return NextResponse.json({ questions: [] })
  }
}
