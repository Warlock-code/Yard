import { NextRequest, NextResponse } from "next/server"
import { prisma } from "@/lib/prisma"
import { signToken, verifyToken } from "@/lib/auth"
import { rateLimitWithInfo } from "@/lib/rateLimit"
import { verifyEmailSchema, validateRequest } from "@/lib/validation"
import { auditLog } from "@/lib/auditLog"
import { REFERRAL_CONFIG } from "@/lib/referral-config"
import { creditUser, CREDIT_CONFIG } from "@/lib/credits"

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

  // Apply referral reward if user was referred. Fail-open: referral money
  // must never break verification (user is already verified above).
  if (user.referredBy) {
    try {
    const referrer = await prisma.user.findUnique({
      where: { inviteCode: user.referredBy },
      select: { id: true, ghostId: true, inviteCode: true },
    })

    if (referrer && referrer.id !== userId) {
      // Check daily cap for referrer
      const dayStart = new Date()
      dayStart.setHours(0, 0, 0, 0)
      const dayEnd = new Date(dayStart)
      dayEnd.setDate(dayEnd.getDate() + 1)

      const todaysRewarded = await prisma.referral.count({
        where: {
          referrerId: referrer.id,
          rewardStatus: "completed",
          createdAt: { gte: dayStart, lt: dayEnd },
        },
      })

      if (todaysRewarded < REFERRAL_CONFIG.DAILY_CAP) {
        // Referral boost: pay 200cr any time and your NEXT completed referral
        // pays 2x (1,000cr referrer / 500cr referee). Unused boosts stack.
        let boostMult = 1
        try {
          const [boosts, usedBoosts] = await Promise.all([
            prisma.creditTransaction.count({ where: { userId: referrer.id, type: "REFERRAL_BOOST" } }),
            prisma.creditTransaction.count({
              where: { userId: referrer.id, type: "REFERRAL", metadata: { path: ["boosted"], equals: true } },
            }),
          ])
          if (boosts > usedBoosts) boostMult = 2
        } catch {
          boostMult = 1
        }
        const referrerReward = CREDIT_CONFIG.EARN.REFERRAL_REFERRER * boostMult
        const refereeReward = CREDIT_CONFIG.EARN.REFERRAL_REFEREE * boostMult
        // Check velocity flag (unusually high referral rate)
        const weekStart = new Date()
        weekStart.setDate(weekStart.getDate() - 7)
        const weekReferrals = await prisma.referral.count({
          where: {
            referrerId: referrer.id,
            createdAt: { gte: weekStart },
          },
        })

        const shouldFlag = weekReferrals >= REFERRAL_CONFIG.VELOCITY_THRESHOLD

        // Credit referrer
        await creditUser(referrer.id, "REFERRAL", referrerReward, `referral_${userId}`, {
          refereeId: userId,
          type: "referrer",
          ...(boostMult > 1 ? { boosted: true } : {}),
        })
        // Credit referee (new user)
        await creditUser(userId, "REFERRAL", refereeReward, `referral_${referrer.id}`, {
          referrerId: referrer.id,
          type: "referee",
          ...(boostMult > 1 ? { boosted: true } : {}),
        })
        // Update referral record (updateMany: no-throw if the signup-time
        // row is missing for any reason — credits above still stand).
        await prisma.referral.updateMany({
          where: { referredId: userId },
          data: {
            status: "completed",
            rewardStatus: shouldFlag ? "flagged" : "completed",
            rewardAmount: referrerReward,
            completedAt: new Date(),
          },
        })

        // Milestone tiers: 5 verified refs → free PLUS month, 10 → free PRIME.
        // Idempotent per milestone via notification dedupe.
        try {
          const verifiedCount = await prisma.referral.count({
            where: { referrerId: referrer.id, rewardStatus: "completed" },
          })
          const milestone = verifiedCount >= 10 ? "PRIME" : verifiedCount >= 5 ? "PLUS" : null
          if (milestone) {
            const seen = await prisma.notification.findFirst({
              where: { userId: referrer.id, type: `referral_milestone_${milestone.toLowerCase()}` },
              select: { id: true },
            })
            if (!seen) {
              const cur = await prisma.user.findUnique({
                where: { id: referrer.id },
                select: { tierExpiresAt: true },
              })
              const base = Math.max(Date.now(), cur?.tierExpiresAt?.getTime() ?? 0)
              await prisma.user.update({
                where: { id: referrer.id },
                data: { tier: milestone as "PLUS" | "PRIME", tierExpiresAt: new Date(base + 31 * 24 * 60 * 60 * 1000) },
              })
              const { createNotification } = await import("@/lib/notifications")
              await createNotification({
                userId: referrer.id,
                type: `referral_milestone_${milestone.toLowerCase()}`,
                title: milestone === "PRIME" ? "👑 10 verified invites — PRIME unlocked!" : "★ 5 verified invites — PLUS unlocked!",
                body: `your invite link did the work. 30 days of ${milestone.toLowerCase()} on the house.`,
                href: "/lair",
              }).catch(() => {})
            }
          }
        } catch {
          // milestone failure never blocks verification
        }

        if (shouldFlag) {
          // Create report for admin review
          await prisma.report.create({
            data: {
              reporterId: referrer.id,
              reason: `High referral velocity: ${weekReferrals} referrals in 7 days`,
              status: "open",
            },
          })
        }
      } else {
        // Daily cap reached - mark referral as pending but don't reward
        await prisma.referral.updateMany({
          where: { referredId: userId },
          data: { status: "completed", rewardStatus: "none", rewardAmount: 0 },
        })
      }
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