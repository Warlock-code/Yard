import { NextRequest, NextResponse } from "next/server"
import { prisma } from "@/lib/prisma"
import { makeVerifyCode } from "@/lib/auth"
import { sendVerifyEmail } from "@/lib/resend"
import { rateLimitWithInfo } from "@/lib/rateLimit"
import { z } from "zod"

const schema = z.object({ userId: z.string().trim().min(1).optional(), email: z.string().trim().email().optional(), }).refine((d) => d.userId || d.email, { message: "User ID or email required." })

export async function POST(req: NextRequest) {
  try {
    const body = await req.json().catch(() => ({}))
    const parsed = schema.safeParse(body)
    if (!parsed.success) {
      return NextResponse.json({ error: parsed.error.issues.map((i) => i.message).join(", ") }, { status: 400 })
    }

    let userId = parsed.data.userId as string | null
    // Allow email fallback if userId not provided (e.g., user closed tab)
    if (!userId && parsed.data.email) {
      const byEmail = await prisma.user.findUnique({ where: { email: parsed.data.email.toLowerCase().trim() } })
      if (byEmail) userId = byEmail.id
    }

    if (!userId) {
      return NextResponse.json({ error: "User ID or email required." }, { status: 400 })
    }

    const rl = rateLimitWithInfo(`resend:${userId}`, 3, 10 * 60 * 1000)
    if (!rl.allowed) {
      const secs = Math.ceil((rl.resetAt - Date.now()) / 1000)
      return NextResponse.json({ error: `Too many resend attempts. Try again in ${secs}s.` }, { status: 429 })
    }

    const user = await prisma.user.findUnique({ where: { id: userId } })
    if (!user) {
      return NextResponse.json({ error: "User not found." }, { status: 404 })
    }
    if (user.emailVerified) {
      return NextResponse.json({ error: "Email already verified.", alreadyVerified: true }, { status: 400 })
    }

    const newCode = makeVerifyCode()
    await prisma.user.update({ where: { id: userId }, data: { verifyCode: newCode } })

    try {
      await sendVerifyEmail(user.email, newCode)
    } catch (err) {
      console.error("[resend-code] send failed for", user.email, err)
      return NextResponse.json({ error: err instanceof Error ? err.message : "Failed to send email. Try again." }, { status: 500 })
    }

    return NextResponse.json({ success: true, message: "Verification code sent." })
  } catch (err) {
    console.error("[resend-code] unexpected", err)
    return NextResponse.json({ error: err instanceof Error ? err.message : "Something went wrong." }, { status: 500 })
  }
}
