import { NextRequest, NextResponse } from "next/server"
import { prisma } from "@/lib/prisma"
import { getCurrentUser } from "@/lib/getCurrentUser"

export async function POST(req: NextRequest) {
  const user = await getCurrentUser(req)
  if (!user) return NextResponse.json({ error: "Not authenticated." }, { status: 401 })

  const { token } = await req.json()
  await prisma.user.update({ where: { id: user.id }, data: { pushToken: token } })

  return NextResponse.json({ success: true })
}