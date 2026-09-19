import { NextRequest, NextResponse } from "next/server"
import { prisma } from "@/lib/prisma"
import { signToken, verifyToken } from "@/lib/auth"
import { rateLimitWithInfo } from "@/lib/rateLimit"
import { verifyEmailSchema, validateRequest } from "@/lib/validation"
import { auditLog } from "@/lib/auditLog"

export async function POST(req: NextRequest) {
  const body = await req.json().catch(() => ({}))
  const validation = validateRequest(verifyEmailSchema, body)
  if (!validation.success) {
    return NextResponse.json({ error: validation.error }, { status: 400 })
  }
  const { code } = validation.data
  // Prefer body.userId (signup flow), fallback to JWT in cookie (verified session)
  let userId: string | null = typeof body.userId === "string" ? body.userId : null
  if (!userId) {
    const token = req.cookies.get("yard_token")?.value
    if (token) {
      const payload = verifyToken(token)
      if (payload) userId = payload.userId
    }
  }

  if (!userId) {
    return NextResponse.json({ error: "User ID required." }, { status: 400 })
  }

  const ip = req.headers.get("x-forwarded-for")?.split(",")[0]?.trim() || req.headers.get("x-real-ip") || "unknown"
  const verifyRl = rateLimitWithInfo(`verify-code:${userId}`, 5, 15 * 60 * 1000)
  if (!verifyRl.allowed) {
    await auditLog("user.verify_email", null, null, { success: false, reason: "Rate limited", userId, ipAddress: ip })
    return NextResponse.json({ error: "Too many verification attempts. Try again later." }, { status: 429 })
  }

  const user = await prisma.user.findUnique({ where: { id: userId } })
  if (!user) {
    return NextResponse.json({ error: "User not found." }, { status: 404 })
  }

  // Already verified — idempotent success (user retried after success, DB has verifyCode null)
  if (user.emailVerified && !user.verifyCode) {
    const token = signToken(user.id)
    const res = NextResponse.json({ success: true, ghostId: user.ghostId, alreadyVerified: true })
    res.cookies.set("yard_token", token, {
      httpOnly: true,
      secure: process.env.NODE_ENV === "production",
      sameSite: "lax",
      maxAge: 60 * 60 * 24 * 30,
      path: "/",
    })
    return res
  }

  // Trim code — email clients sometimes add spaces
  const cleanCode = code.trim()
  if (user.verifyCode !== cleanCode) {
    await auditLog("user.verify_email", userId, userId, { success: false, reason: "Invalid code", ipAddress: ip })
    return NextResponse.json({ error: "Invalid code. Check your email or request a new code." }, { status: 400 })
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

  await auditLog("user.verify_email", userId, userId, { success: true, ipAddress: ip })

  return res
}