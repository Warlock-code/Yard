import { NextRequest, NextResponse } from "next/server"
import { prisma } from "@/lib/prisma"
import { getCurrentUser } from "@/lib/getCurrentUser"
import { getEffectiveTier } from "@/lib/tier"

export async function GET(req: NextRequest) {
  const user = await getCurrentUser(req)
  if (!user) return NextResponse.json({ error: "Not authenticated." }, { status: 401 })

  const effectiveTier = getEffectiveTier(user)
  if (effectiveTier !== "PRIME") {
    return NextResponse.json({ error: "Only Prime users can view payouts." }, { status: 403 })
  }

  const payouts = await prisma.payout.findMany({
    where: { userId: user.id },
    orderBy: { requestedAt: "desc" },
    select: {
      id: true,
      amount: true,
      status: true,
      bankCode: true,
      accountNumber: true,
      accountName: true,
      requestedAt: true,
      processedAt: true,
      providerTransferRef: true,
    },
  })

  return NextResponse.json({ payouts })
}