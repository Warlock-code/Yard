import { NextRequest, NextResponse } from "next/server"
import { prisma } from "@/lib/prisma"
import { hashPassword } from "@/lib/auth"
import { rateLimit } from "@/lib/rateLimit"
import { resetPasswordSchema, validateRequest } from "@/lib/validation"
import { auditLog } from "@/lib/auditLog"

export async function POST(req: NextRequest) {
  try {
    const body = await req.json().catch(() => ({}))
    const validation = validateRequest(resetPasswordSchema, body)
    if (!validation.success) {
      return NextResponse.json({ error: validation.error }, { status: 400 })
    }
    const { token, password } = validation.data

    const ip = req.headers.get("x-forwarded-for")?.split(",")[0]?.trim() || req.headers.get("x-real-ip") || "unknown"

    const rl = rateLimit(`reset-password:${token}`, 5, 15 * 60 * 1000)
    if (!rl) {
      await auditLog("user.reset_password", null, null, { success: false, reason: "Rate limited", ipAddress: ip })
      return NextResponse.json({ error: "Too many attempts. Try again later." }, { status: 429 })
    }

    const user = await prisma.user.findUnique({ where: { resetToken: token } })
    if (!user || !user.resetTokenExpiry || user.resetTokenExpiry < new Date()) {
      await auditLog("user.reset_password", null, null, { success: false, reason: "Invalid or expired token", ipAddress: ip })
      return NextResponse.json({ error: "Invalid or expired reset link." }, { status: 400 })
    }

    const passwordHash = await hashPassword(password)

    await prisma.user.update({
      where: { id: user.id },
      data: {
        passwordHash,
        resetToken: null,
        resetTokenExpiry: null,
      },
    })

    await auditLog("user.reset_password", user.id, user.id, { success: true, email: user.email, ipAddress: ip })

    return NextResponse.json({ success: true, message: "Password reset successful. You can now log in." })
  } catch (err) {
    console.error("[reset-password] unexpected error", err)
    return NextResponse.json({ error: "Something went wrong. Please try again." }, { status: 500 })
  }
}