import { NextRequest, NextResponse } from "next/server"
import { prisma } from "@/lib/prisma"
import { getCurrentUser } from "@/lib/getCurrentUser"
import { rateLimit } from "@/lib/rateLimit"

export async function DELETE(req: NextRequest) {
  const user = await getCurrentUser(req)
  if (!user) return NextResponse.json({ error: "Not authenticated." }, { status: 401 })

  const allowed = await rateLimit(`delete-account:${user.id}`, 1, 24 * 60 * 60 * 1000)
  if (!allowed) {
    return NextResponse.json({ error: "Too many requests. Try again tomorrow." }, { status: 429 })
  }

  const { password } = await req.json().catch(() => ({}))
  if (typeof password !== "string" || !password) {
    return NextResponse.json({ error: "Password confirmation required." }, { status: 400 })
  }

  const bcrypt = await import("bcryptjs")
  const valid = await bcrypt.compare(password, user.passwordHash)
  if (!valid) {
    return NextResponse.json({ error: "Incorrect password." }, { status: 400 })
  }

  await prisma.user.delete({ where: { id: user.id } })

  const response = NextResponse.json({ success: true })
  response.cookies.set("yard_token", "", { maxAge: 0, path: "/" })
  response.cookies.set("yard_seen_welcome", "", { maxAge: 0, path: "/" })
  return response
}