import { NextRequest, NextResponse } from "next/server"
import { prisma } from "@/lib/prisma"
import { generateSecureToken } from "@/lib/auth"
import { sendResetEmail } from "@/lib/resend"
import { rateLimit, rateLimitWithInfo } from "@/lib/rateLimit"
import { forgotPasswordSchema, validateRequest } from "@/lib/validation"
import { auditLog } from "@/lib/auditLog"

export async function POST(req: NextRequest) {
  try {
    const body = await req.json().catch(() => ({}))
    const validation = validateRequest(forgotPasswordSchema, body)
    if (!validation.success) {
      return NextResponse.json({ error: validation.error }, { status: 400 })
    }
    const { email } = validation.data
    const normalizedEmail = email.trim().toLowerCase()

    const ip = req.headers.get("x-forwarded-for")?.split(",")[0]?.trim() || req.headers.get("x-real-ip") || "unknown"

    const rl = rateLimit(`forgot-password:${normalizedEmail}`, 3, 60 * 60 * 1000)
    if (!rl) {
      await auditLog("user.forgot_password", null, null, { success: false, reason: "Rate limited", email: normalizedEmail, ipAddress: ip })
      return NextResponse.json({ error: "Too many attempts. Try again later." }, { status: 429 })
    }

    const emailRl = rateLimitWithInfo(`reset-email:${normalizedEmail}`, 2, 60 * 60 * 1000)
    if (!emailRl.allowed) {
      await auditLog("user.forgot_password", null, null, { success: false, reason: "Email rate limited", email: normalizedEmail, ipAddress: ip })
      return NextResponse.json({ error: "Too many reset emails sent. Try again later." }, { status: 429 })
    }

    const user = await prisma.user.findUnique({ where: { email: normalizedEmail } })
    if (!user) {
      return NextResponse.json({ success: true, message: "If the email exists, a reset link has been sent." })
    }

    const resetToken = generateSecureToken(32)
    const resetTokenExpiry = new Date(Date.now() + 60 * 60 * 1000)

    await prisma.user.update({
      where: { id: user.id },
      data: { resetToken, resetTokenExpiry },
    })

    try {
      const resetUrl = `${process.env.NEXT_PUBLIC_APP_URL || "https://yardapp.me"}/reset-password?token=${resetToken}`
      await sendResetEmail(normalizedEmail, resetUrl)
    } catch (emailErr) {
      console.error("[forgot-password] sendResetEmail failed for", normalizedEmail, emailErr)
      await auditLog("user.forgot_password", user.id, user.id, { success: true, email: normalizedEmail, emailFailed: true, ipAddress: ip })
      return NextResponse.json({ success: true, message: "If the email exists, a reset link has been sent.", emailFailed: true })
    }

    await auditLog("user.forgot_password", user.id, user.id, { success: true, email: normalizedEmail, ipAddress: ip })

    return NextResponse.json({ success: true, message: "If the email exists, a reset link has been sent." })
  } catch (err) {
    console.error("[forgot-password] unexpected error", err)
    return NextResponse.json({ error: "Something went wrong. Please try again." }, { status: 500 })
  }
}