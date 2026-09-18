import { NextRequest, NextResponse } from "next/server"
import { prisma } from "@/lib/prisma"
import { getCurrentUser } from "@/lib/getCurrentUser"
import { generateInviteCode } from "@/lib/share"

export async function GET(req: NextRequest) {
  const user = await getCurrentUser(req)
  if (!user) return NextResponse.json({ error: "Not authenticated." }, { status: 401 })

  const dbUser = await prisma.user.findUnique({
    where: { id: user.id },
    select: { inviteCode: true, referralCount: true, ghostCoins: true, streakFreezeUntil: true },
  })

  if (!dbUser) return NextResponse.json({ error: "User not found." }, { status: 404 })

  const baseUrl = process.env.NEXT_PUBLIC_APP_URL || "https://yardapp.me"
  const inviteUrl = `${baseUrl}/signup?ref=${dbUser.inviteCode}`

  return NextResponse.json({
    inviteCode: dbUser.inviteCode,
    inviteUrl,
    referralCount: dbUser.referralCount,
    rewards: {
      ghostCoins: dbUser.ghostCoins,
      hasStreakFreeze: dbUser.streakFreezeUntil ? dbUser.streakFreezeUntil > new Date() : false,
    },
  })
}

export async function POST(req: NextRequest) {
  const user = await getCurrentUser(req)
  if (!user) return NextResponse.json({ error: "Not authenticated." }, { status: 401 })

  const body = await req.json().catch(() => ({}))
  const { action } = body

  if (action === "regenerate") {
    let newCode: string
    let attempts = 0
    do {
      newCode = generateInviteCode()
      attempts++
      if (attempts > 10) {
        return NextResponse.json({ error: "Failed to generate unique code." }, { status: 500 })
      }
    } while (await prisma.user.findUnique({ where: { inviteCode: newCode } }))

    await prisma.user.update({
      where: { id: user.id },
      data: { inviteCode: newCode },
    })

    const baseUrl = process.env.NEXT_PUBLIC_APP_URL || "https://yardapp.me"
    return NextResponse.json({
      inviteCode: newCode,
      inviteUrl: `${baseUrl}/signup?ref=${newCode}`,
    })
  }

  return NextResponse.json({ error: "Invalid action." }, { status: 400 })
}