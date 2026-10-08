import { NextRequest, NextResponse } from "next/server"
import { isAdmin } from "@/lib/getAdmin"
import { prisma } from "@/lib/prisma"
import { decrypt } from "@/lib/payoutEncryption"

export const dynamic = "force-dynamic"

function tryDecrypt(value: string | null): string | null {
  if (!value) return null
  try {
    return decrypt(value)
  } catch {
    // Rows stored before encryption — show raw.
    return value
  }
}

export async function GET(req: NextRequest) {
  if (!isAdmin(req)) {
    return NextResponse.json({ error: "not authorized." }, { status: 403 })
  }

  const { searchParams } = new URL(req.url)
  const status = searchParams.get("status") || "pending"

  const where =
    status === "all"
      ? {}
      : status === "paid"
        ? { status: "paid" }
        : { status: "pending" }

  const payouts = await prisma.creditPayout.findMany({
    where,
    include: { user: { select: { ghostId: true, email: true, tier: true } } },
    orderBy: { requestedAt: "desc" },
    take: 100,
  })

  return NextResponse.json({
    payouts: payouts.map((p) => ({
      id: p.id,
      amount: p.netGhsAmount,
      creditsAmount: p.creditsAmount,
      ghsAmount: p.ghsAmount,
      feeAmount: p.feeAmount,
      status: p.status,
      accountName: tryDecrypt(p.accountName),
      accountNumber: tryDecrypt(p.accountNumber),
      bankCode: tryDecrypt(p.bankCode),
      requestedAt: p.requestedAt,
      user: p.user,
    })),
  })
}
