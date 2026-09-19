import { NextRequest, NextResponse } from "next/server"
import { prisma } from "@/lib/prisma"
import { comparePassword, signToken } from "@/lib/auth"
import { rateLimitWithInfo, clearRateLimit } from "@/lib/rateLimit"
import { loginSchema, validateRequest } from "@/lib/validation"

const MAX_FAILED_ATTEMPTS = 5
const LOCKOUT_DURATION = 15 * 60 * 1000

export async function POST(req: NextRequest) {
  try {
  const body = await req.json().catch(() => ({}))
  const validation = validateRequest(loginSchema, body)
  if (!validation.success) {
    return NextResponse.json({ error: validation.error }, { status: 400 })
  }
  const { email, password } = validation.data
  const normalizedEmail = email.trim().toLowerCase()

  const lockoutKey = `lockout:${normalizedEmail}`
  const lockout = rateLimitWithInfo(lockoutKey, MAX_FAILED_ATTEMPTS, LOCKOUT_DURATION)
  if (!lockout.allowed) {
    const minutes = Math.ceil((lockout.resetAt - Date.now()) / 60000)
    return NextResponse.json({ error: `Too many failed attempts. Try again in ${minutes} minutes.` }, { status: 429 })
  }

  const user = await prisma.user.findUnique({ where: { email: normalizedEmail } })
  if (!user) {
    return NextResponse.json({ error: "Invalid credentials." }, { status: 400 })
  }

  const valid = await comparePassword(password, user.passwordHash)
  if (!valid) {
    return NextResponse.json({ error: "Invalid credentials." }, { status: 400 })
  }

  if (!user.emailVerified) {
    return NextResponse.json({ error: "Verify your email first.", userId: user.id }, { status: 403 })
  }

  if (user.status !== "ACTIVE") {
    return NextResponse.json({ error: "Account suspended." }, { status: 403 })
  }

  // Success: clear failed lockout count
  clearRateLimit(lockoutKey)

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
  } catch (err) {
    console.error("[login] unexpected", err)
    if (err instanceof Error && err.message.includes("JWT_SECRET")) {
      return NextResponse.json({ error: "Service temporarily unavailable. Please try again later." }, { status: 500 })
    }
    return NextResponse.json({ error: "Something went wrong. Please try again." }, { status: 500 })
  }
}