import { NextRequest, NextResponse } from "next/server"
import { prisma } from "@/lib/prisma"
import { signToken, verifyToken } from "@/lib/auth"
import { rateLimitWithInfo } from "@/lib/rateLimit"
import { verifyEmailSchema, validateRequest } from "@/lib/validation"
import { auditLog } from "@/lib/auditLog"
import { completeReferralReward } from "@/lib/referral-rewards"

export async function POST(req: NextRequest) {
  try {
  const body = await req.json().catch(() => ({}))
  const validation = validateRequest(verifyEmailSchema, body)
  if (!validation.success) {
    return NextResponse.json({ error: validation.error }, { status: 400 })
  }
  const { code } = validation.data
  // Prefer body.userId (signup flow), fallback to JWT in cookie (verified session)
  let userId: string | null = typeof body.userId === "string" ? body.userId.trim() : null
  // normalize - handle empty string
  if (userId === "") userId = null
  if (!userId) {
    const token = req.cookies.get("yard_token")?.value
    if (token) {
      const payload = verifyToken(token)
      if (payload) userId = payload.userId
    }
  }

  // Also allow email fallback if userId missing but email provided
  if (!userId && typeof body.email === "string" && body.email.trim()) {
    const byEmail = await prisma.user.findUnique({ where: { email: body.email.trim().toLowerCase() } })
    if (byEmail) userId = byEmail.id
  }

  if (!userId) {
    return NextResponse.json({ error: "missing account. Please sign up again or log in." }, { status: 400 })
  }

  const ip = req.headers.get("x-forwarded-for")?.split(",")[0]?.trim() || req.headers.get("x-real-ip") || "unknown"
  const verifyRl = await rateLimitWithInfo(`verify-code:${userId}`, 5, 15 * 60 * 1000)
  if (!verifyRl.allowed) {
    await auditLog("user.verify_email", null, null, { success: false, reason: "Rate limited", userId, ipAddress: ip })
    return NextResponse.json({ error: "too many verification attempts. Try again later." }, { status: 429 })
  }

  const user = await prisma.user.findUnique({ where: { id: userId } })
  if (!user) {
    return NextResponse.json({ error: "user not found." }, { status: 404 })
  }

  // Already verified — idempotent success
  if (user.emailVerified) {
    // Clean up stale verifyCode if needed
    if (user.verifyCode) {
      await prisma.user.update({ where: { id: userId }, data: { verifyCode: null } })
    }
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

  if (!user.verifyCode) {
    await auditLog("user.verify_email", userId, userId, { success: false, reason: "No code", ipAddress: ip })
    return NextResponse.json({ error: "no verification code found. Please request a new code." }, { status: 400 })
  }

  // Normalize code — strip spaces and non-digits just in case user pasted with formatting
  const cleanCode = code.trim().replace(/\s+/g, "")
  if (user.verifyCode !== cleanCode) {
    await auditLog("user.verify_email", userId, userId, { success: false, reason: "Invalid code", ipAddress: ip, attemptedCode: cleanCode })
    return NextResponse.json({ error: "invalid code. Check your email or request a new code." }, { status: 400 })
  }

  await prisma.user.update({
    where: { id: userId },
    data: { emailVerified: true, verifyCode: null },
  })

  // Legacy fallback: new signups are auto-verified and paid immediately by
  // /api/auth/signup. Keep this for older verification-code accounts.
  // completeReferralReward is idempotent, so a repeated call never double-pays.
  if (user.referredBy) {
    try {
      const reward = await completeReferralReward(userId)
      if (
        reward.status !== "completed" &&
        reward.status !== "flagged" &&
        reward.status !== "already_completed"
      ) {
        console.warn("[verify-email] referral reward not applied", {
          userId,
          status: reward.status,
        })
      }
    } catch (err) {
      console.error("[verify-email] referral reward failed (verification kept)", err)
    }
  }

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
  } catch (err) {
    console.error("[verify-email] unexpected", err)
    if (err instanceof Error && err.message.includes("JWT_SECRET")) {
      return NextResponse.json({ error: "service temporarily unavailable. Please try again later." }, { status: 500 })
    }
    return NextResponse.json({ error: err instanceof Error ? err.message : "Something went wrong. Please try again." }, { status: 500 })
  }
}