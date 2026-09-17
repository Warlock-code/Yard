import { NextRequest, NextResponse } from "next/server"
import { prisma } from "@/lib/prisma"
import { getCurrentUser } from "@/lib/getCurrentUser"

export async function POST(req: NextRequest) {
  const user = await getCurrentUser(req)
  if (!user) return NextResponse.json({ error: "Not authenticated." }, { status: 401 })

  const { token } = await req.json()
  if (typeof token !== "string" || !token.trim()) {
    return NextResponse.json({ error: "A push token is required." }, { status: 400 })
  }

  await prisma.deviceToken.upsert({
    where: { token },
    update: { userId: user.id, platform: "android" },
    create: { userId: user.id, token, platform: "android" },
  })
  await prisma.user.update({ where: { id: user.id }, data: { pushToken: token } })
  console.info("FCM device token registered", { userId: user.id })

  return NextResponse.json({ success: true })
}