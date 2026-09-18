import { NextRequest, NextResponse } from "next/server"
import { prisma } from "@/lib/prisma"
import { isAdmin } from "@/lib/getAdmin"

export const dynamic = "force-dynamic"

export async function GET(req: NextRequest) {
  if (!isAdmin(req)) {
    return NextResponse.json({ error: "Not authorized." }, { status: 403 })
  }

  const payouts = await prisma.payout.findMany({
    where: { status: "pending" },
    orderBy: { requestedAt: "desc" },
    include: { user: { select: { ghostId: true, email: true } } },
  })

  return NextResponse.json({ payouts })
}