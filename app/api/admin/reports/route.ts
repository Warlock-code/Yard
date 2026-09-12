import { NextRequest, NextResponse } from "next/server"
import { prisma } from "@/lib/prisma"
import { getCurrentUser } from "@/lib/getCurrentUser"

const ADMIN_EMAILS = [process.env.ADMIN_EMAIL || ""]

export async function GET(req: NextRequest) {
  const user = await getCurrentUser(req)
  if (!user || !ADMIN_EMAILS.includes(user.email)) {
    return NextResponse.json({ error: "Not authorized." }, { status: 403 })
  }

  const reports = await prisma.report.findMany({
    where: { status: "open" },
    orderBy: { createdAt: "desc" },
    include: { post: true, reporter: { select: { ghostId: true } } },
  })

  return NextResponse.json({ reports })
}