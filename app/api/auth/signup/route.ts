import { NextRequest, NextResponse } from "next/server"
import { prisma } from "@/lib/prisma"
import { hashPassword, makeGhostId, makeVerifyCode } from "@/lib/auth"
import { getCampusFromEmail } from "@/lib/schoolEmails"
import { sendVerifyEmail } from "@/lib/resend"
import { rateLimit, rateLimitWithInfo } from "@/lib/rateLimit"
import { getProgramKey } from "@/lib/program"
import { signupSchema, validateRequest } from "@/lib/validation"
import { auditLog } from "@/lib/auditLog"
import { generateInviteCode } from "@/lib/share"

export async function POST(req: NextRequest) {
  try {
  const body = await req.json().catch(() => ({}))
  const validation = validateRequest(signupSchema, body)
  if (!validation.success) {
    return NextResponse.json({ error: validation.error }, { status: 400 })
  }
  const { email, password, programLevel, program } = validation.data
  const normalizedEmail = email.trim().toLowerCase()
  const rawReferral = typeof body.referralCode === "string" ? body.referralCode.trim() : ""
  const referralCode = rawReferral ? rawReferral.toUpperCase() : null

  const ip = req.headers.get("x-forwarded-for")?.split(",")[0]?.trim() || req.headers.get("x-real-ip") || "unknown"

  const campus = getCampusFromEmail(normalizedEmail)
  if (!campus) {
    return NextResponse.json({ error: "Use a valid school email." }, { status: 400 })
  }

  const rl = rateLimit(`signup:${normalizedEmail}`, 3, 60 * 60 * 1000)
  if (!rl) {
    await auditLog("user.signup", null, null, { success: false, reason: "Rate limited", email: normalizedEmail, ipAddress: ip })
    return NextResponse.json({ error: "Too many signup attempts. Try again later." }, { status: 429 })
  }

  const emailRl = rateLimitWithInfo(`verify-email:${normalizedEmail}`, 2, 60 * 60 * 1000)
  if (!emailRl.allowed) {
    await auditLog("user.signup", null, null, { success: false, reason: "Email rate limited", email: normalizedEmail, ipAddress: ip })
    return NextResponse.json({ error: "Too many verification emails sent. Try again later." }, { status: 429 })
  }

  const existing = await prisma.user.findUnique({ where: { email: normalizedEmail } })
  if (existing) {
    return NextResponse.json({ error: "Account already exists." }, { status: 400 })
  }

  const passwordHash = await hashPassword(password)
  const verifyCode = makeVerifyCode()
  // Ensure ghostId uniqueness with retry loop (was missing, caused P2002 on collision)
  let ghostId: string
  let ghostAttempts = 0
  do {
    ghostId = makeGhostId()
    ghostAttempts++
    if (ghostAttempts > 10) {
      return NextResponse.json({ error: "Failed to generate ghost ID. Please try again." }, { status: 500 })
    }
  } while (await prisma.user.findUnique({ where: { ghostId } }))

  let inviteCode: string
  let attempts = 0
  do {
    inviteCode = generateInviteCode()
    attempts++
    if (attempts > 10) {
      return NextResponse.json({ error: "Failed to generate invite code." }, { status: 500 })
    }
  } while (await prisma.user.findUnique({ where: { inviteCode } }))

  // Validate referral exists before storing; don't persist invalid codes
  let validatedReferralCode: string | null = null
  let referrer: { id: string } | null = null
  if (referralCode) {
    referrer = await prisma.user.findUnique({ where: { inviteCode: referralCode }, select: { id: true } })
    if (referrer) validatedReferralCode = referralCode
  }

  let user
  try {
    user = await prisma.user.create({
      data: {
        email: normalizedEmail,
        passwordHash,
        campus,
        programLevel: programLevel?.trim() || null,
        program: program?.trim() || null,
        programKey: getProgramKey(campus, program),
        ghostId,
        verifyCode,
        inviteCode,
        referredBy: validatedReferralCode,
      },
    })
  } catch (createErr: unknown) {
    // Handle race where email/ghostId/inviteCode collision happens between check and create
    if (createErr instanceof Error && (createErr as any).code === "P2002") {
      const target = (createErr as any).meta?.target as string[] | undefined
      if (target?.includes("email")) {
        return NextResponse.json({ error: "Account already exists." }, { status: 400 })
      }
      // Ghost/invite collision: ask to retry
      return NextResponse.json({ error: "Something went wrong creating your ghost. Please try again." }, { status: 500 })
    }
    throw createErr
  }

  if (referrer && validatedReferralCode && referrer.id !== user.id) {
    try {
      await prisma.$transaction([
        prisma.referral.create({
          data: {
            referrerId: referrer.id,
            referredId: user.id,
          },
        }),
        prisma.user.update({
          where: { id: referrer.id },
          data: { referralCount: { increment: 1 } },
        }),
      ])
      await auditLog("user.referral", referrer.id, user.id, { referralCode: validatedReferralCode, inviteeId: user.id, ipAddress: ip })
    } catch (e) {
      console.error("[signup] referral transaction failed", e)
      // Don't fail signup if referral fails; user is already created
    }
  }

  const referralMeta = referralCode && !validatedReferralCode ? { referralInvalid: true } : {}

  try {
    await sendVerifyEmail(normalizedEmail, verifyCode)
  } catch (emailErr) {
    console.error("[signup] sendVerifyEmail failed for", normalizedEmail, emailErr)
    // Don't fail signup if email fails — user can resend code
    // Still audit and return success but include a warning
    // Sanitize error message to avoid leaking internal details
    await auditLog("user.signup", user.id, user.id, { success: true, email: normalizedEmail, campus, ghostId, inviteCode, referralCode, ipAddress: ip, emailFailed: true, ...referralMeta })
    return NextResponse.json({ userId: user.id, ghostId: user.ghostId, emailFailed: true, message: "Failed to send verification email. Please resend code." })
  }

  await auditLog("user.signup", user.id, user.id, { success: true, email: normalizedEmail, campus, ghostId, inviteCode, referralCode, ipAddress: ip, ...referralMeta })

  return NextResponse.json({ userId: user.id, ghostId: user.ghostId })
  } catch (err) {
    console.error("[signup] unexpected error", err)
    // Don't leak internal error details (Prisma, etc.) to client
    if (err instanceof Error && err.message.includes("Account already exists")) {
      return NextResponse.json({ error: err.message }, { status: 400 })
    }
    return NextResponse.json({ error: "Something went wrong. Please try again." }, { status: 500 })
  }
}