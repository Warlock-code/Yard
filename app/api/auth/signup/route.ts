import { NextRequest, NextResponse } from "next/server"
import { prisma } from "@/lib/prisma"
import { hashPassword, makeGhostId, makeVerifyCode, generateSecureToken } from "@/lib/auth"
import { getCampusFromEmail } from "@/lib/schoolEmails"
import { sendVerifyEmail } from "@/lib/resend"
import { rateLimit, rateLimitWithInfo } from "@/lib/rateLimit"
import { getProgramKey } from "@/lib/program"
import { signupSchema, validateRequest } from "@/lib/validation"
import { auditLog } from "@/lib/auditLog"
import { generateInviteCode } from "@/lib/share"

export async function POST(req: NextRequest) {
  const body = await req.json().catch(() => ({}))
  const validation = validateRequest(signupSchema, body)
  if (!validation.success) {
    return NextResponse.json({ error: validation.error }, { status: 400 })
  }
  const { email, password, programLevel, program } = validation.data
  const normalizedEmail = email.trim().toLowerCase()
  const referralCode = body.referralCode as string | undefined

  const ip = req.headers.get("x-forwarded-for")?.split(",")[0]?.trim() || req.headers.get("x-real-ip") || "unknown"

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

  const campus = getCampusFromEmail(normalizedEmail)
  if (!campus) {
    return NextResponse.json({ error: "Use a valid school email." }, { status: 400 })
  }

  const existing = await prisma.user.findUnique({ where: { email: normalizedEmail } })
  if (existing) {
    return NextResponse.json({ error: "Account already exists." }, { status: 400 })
  }

  const passwordHash = await hashPassword(password)
  const verifyCode = makeVerifyCode()
  const ghostId = makeGhostId()

  let inviteCode: string
  let attempts = 0
  do {
    inviteCode = generateInviteCode()
    attempts++
    if (attempts > 10) {
      return NextResponse.json({ error: "Failed to generate invite code." }, { status: 500 })
    }
  } while (await prisma.user.findUnique({ where: { inviteCode } }))

  const user = await prisma.user.create({
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
      referredBy: referralCode || null,
    },
  })

  if (referralCode) {
    const referrer = await prisma.user.findUnique({ where: { inviteCode: referralCode } })
    if (referrer && referrer.id !== user.id) {
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
      await auditLog("user.referral", referrer.id, user.id, { referralCode, inviteeId: user.id, ipAddress: ip })
    }
  }

  await sendVerifyEmail(normalizedEmail, verifyCode)

  await auditLog("user.signup", user.id, user.id, { success: true, email: normalizedEmail, campus, ghostId, inviteCode, referralCode, ipAddress: ip })

  return NextResponse.json({ userId: user.id, ghostId: user.ghostId })
}