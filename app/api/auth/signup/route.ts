import { NextRequest, NextResponse } from "next/server"
import { prisma } from "@/lib/prisma"
import { hashPassword, makeGhostId, makeVerifyCode } from "@/lib/auth"
import { getCampusFromEmail } from "@/lib/schoolEmails"
import { sendVerifyEmail } from "@/lib/resend"
import { rateLimit } from "@/lib/rateLimit"
import { getProgramKey } from "@/lib/program"

export async function POST(req: NextRequest) {
  const { email, password, programLevel, program } = await req.json()
  const normalizedEmail = typeof email === "string" ? email.trim().toLowerCase() : ""
  if (!normalizedEmail || typeof password !== "string" || password.length < 8) {
    return NextResponse.json({ error: "Use a valid email and a password of at least 8 characters." }, { status: 400 })
  }
  if (!rateLimit(`signup:${normalizedEmail}`, 3, 60 * 60 * 1000)) {
    return NextResponse.json({ error: "Too many signup attempts. Try again later." }, { status: 429 })
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

  const user = await prisma.user.create({
    data: {
      email: normalizedEmail,
      passwordHash,
      campus,
      programLevel: typeof programLevel === "string" ? programLevel.trim() || null : null,
      program: typeof program === "string" ? program.trim() || null : null,
      programKey: getProgramKey(campus, program),
      ghostId,
      verifyCode,
    },
  })

  await sendVerifyEmail(normalizedEmail, verifyCode)

  return NextResponse.json({ userId: user.id, ghostId: user.ghostId })
}