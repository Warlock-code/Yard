import { NextRequest, NextResponse } from "next/server"
import { signAdminToken } from "@/lib/adminAuth"

export async function POST(req: NextRequest) {
  const { username, password } = await req.json()

  if (username !== process.env.ADMIN_USERNAME || password !== process.env.ADMIN_PASSWORD) {
    return NextResponse.json({ error: "Invalid credentials." }, { status: 401 })
  }

  const token = signAdminToken()
  const res = NextResponse.json({ success: true })
  res.cookies.set("yard_admin_token", token, {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "lax",
    maxAge: 60 * 60 * 24 * 7,
    path: "/",
  })
  return res
}