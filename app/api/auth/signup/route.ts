import { NextRequest, NextResponse } from "next/server"
import { prisma, withDbRetry, isDbConnectionError } from "@/lib/prisma"
import { hashPassword, makeGhostId, signToken } from "@/lib/auth"
import { getCampusFromEmail } from "@/lib/schoolEmails"
import { rateLimit } from "@/lib/rateLimit"
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
    return NextResponse.json({ error: "use a valid school email." }, { status: 400 })
  }

  // 10 attempts/hour per email: enough for legit retries after typos,
  // still blocks credential-stuffing. Per-email key keeps one user's
  // retries from blocking anyone else.
  const rl = await rateLimit(`signup:${normalizedEmail}`, 10, 60 * 60 * 1000)
  if (!rl) {
    await auditLog("user.signup", null, null, { success: false, reason: "Rate limited", email: normalizedEmail, ipAddress: ip })
    return NextResponse.json({ error: "too many signup attempts. Try again later." }, { status: 429 })
  }

  // Retry once: Neon pooled connections go cold when idle and the first
  // query can fail even though the database is healthy.
  const existing = await withDbRetry(() => prisma.user.findUnique({ where: { email: normalizedEmail } }))
  if (existing) {
    return NextResponse.json({ error: "account already exists." }, { status: 400 })
  }

  const passwordHash = await hashPassword(password)
  // Ensure ghostId uniqueness with retry loop (was missing, caused P2002 on collision)
  let ghostId: string
  let ghostAttempts = 0
  do {
    ghostId = makeGhostId()
    ghostAttempts++
    if (ghostAttempts > 10) {
      return NextResponse.json({ error: "failed to generate ghost ID. Please try again." }, { status: 500 })
    }
  } while (await withDbRetry(() => prisma.user.findUnique({ where: { ghostId } })))

  let inviteCode: string
  let attempts = 0
  do {
    inviteCode = generateInviteCode()
    attempts++
    if (attempts > 10) {
      return NextResponse.json({ error: "failed to generate invite code." }, { status: 500 })
    }
  } while (await withDbRetry(() => prisma.user.findUnique({ where: { inviteCode } })))

  // Validate referral exists before storing; don't persist invalid codes
  let validatedReferralCode: string | null = null
  let referrer: { id: string } | null = null
  if (referralCode) {
    referrer = await withDbRetry(() => prisma.user.findUnique({ where: { inviteCode: referralCode }, select: { id: true } }))
    if (referrer) validatedReferralCode = referralCode
  }

  let user
  try {
    user = await withDbRetry(() =>
      prisma.user.create({
        data: {
          email: normalizedEmail,
          passwordHash,
          campus,
          programLevel: programLevel?.trim() || null,
          program: program?.trim() || null,
          programKey: getProgramKey(campus, program),
          ghostId,
          emailVerified: true,
          inviteCode,
          referredBy: validatedReferralCode,
        },
      })
    )
  } catch (createErr: unknown) {
    // Handle race where email/ghostId/inviteCode collision happens between check and create
    if (createErr instanceof Error && (createErr as any).code === "P2002") {
      const target = (createErr as any).meta?.target as string[] | undefined
      if (target?.includes("email")) {
        return NextResponse.json({ error: "account already exists." }, { status: 400 })
      }
      // Ghost/invite collision: ask to retry
      return NextResponse.json({ error: "something went wrong creating your ghost. Please try again." }, { status: 500 })
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

  // Issue JWT immediately since email is auto-verified
  const token = signToken(user.id)
  const res = NextResponse.json({ userId: user.id, ghostId: user.ghostId, token })
  res.cookies.set("yard_token", token, {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "lax",
    maxAge: 60 * 60 * 24 * 30,
    path: "/",
  })

  await auditLog("user.signup", user.id, user.id, { success: true, email: normalizedEmail, campus, ghostId, inviteCode, referralCode, ipAddress: ip, ...referralMeta })

  return res
  } catch (err) {
    console.error("[signup] unexpected error", err)
    // Connection blips (Neon waking from sleep) get a 503 + actionable
    // message so users retry instead of thinking signup is broken.
    if (isDbConnectionError(err)) {
      return NextResponse.json({ error: "database is waking up. please try again in a few seconds." }, { status: 503 })
    }
    // Don't leak internal error details (Prisma, etc.) to client
    if (err instanceof Error && err.message.includes("account already exists")) {
      return NextResponse.json({ error: err.message }, { status: 400 })
    }
    return NextResponse.json({ error: "something went wrong. Please try again." }, { status: 500 })
  }
}