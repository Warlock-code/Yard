import { NextRequest, NextResponse } from "next/server"
import { prisma } from "@/lib/prisma"
import { signToken } from "@/lib/auth"

export async function POST(req: NextRequest) {
  const { userId, code } = await req.json()

  const user = await prisma.user.findUnique({ where: { id: userId } })
  if (!user) {
    return NextResponse.json({ error: "User not found." }, { status: 404 })
  }

  if (user.verifyCode !== code) {
    return NextResponse.json({ error: "Invalid code." }, { status: 400 })
  }

  await prisma.user.update({
    where: { id: userId },
    data: { emailVerified: true, verifyCode: null },
  })

  const token = signToken(user.id)
  const res = NextResponse.json({ success: true, ghostId: user.ghostId })
  res.cookies.set("yard_token", token, {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "lax",
    maxAge: 60 * 60 * 24 * 30,
    path: "/",
  })

  return res
}