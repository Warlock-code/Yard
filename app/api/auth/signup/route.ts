import { NextRequest, NextResponse } from "next/server"
import { prisma } from "@/lib/prisma"
import { hashPassword, makeGhostId, makeVerifyCode } from "@/lib/auth"
import { getCampusFromEmail } from "@/lib/schoolEmails"
import { sendVerifyEmail } from "@/lib/resend"

export async function POST(req: NextRequest) {
  const { email, password, programLevel, program } = await req.json()

  const campus = getCampusFromEmail(email)
  if (!campus) {
    return NextResponse.json({ error: "Use a valid school email." }, { status: 400 })
  }

  const existing = await prisma.user.findUnique({ where: { email } })
  if (existing) {
    return NextResponse.json({ error: "Account already exists." }, { status: 400 })
  }

  const passwordHash = await hashPassword(password)
  const verifyCode = makeVerifyCode()
  const ghostId = makeGhostId()

  const user = await prisma.user.create({
    data: {
      email,
      passwordHash,
      campus,
      programLevel,
      program,
      ghostId,
      verifyCode,
    },
  })

  await sendVerifyEmail(email, verifyCode)

  return NextResponse.json({ userId: user.id, ghostId: user.ghostId })
}