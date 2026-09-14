import { NextRequest, NextResponse } from "next/server"
import { prisma } from "@/lib/prisma"
import { isAdmin } from "@/lib/getAdmin"

export async function GET(req: NextRequest) {
  if (!isAdmin(req)) return NextResponse.json({ error: "Not authorized." }, { status: 403 })

  const [userCount, postCount, primeCount, plusCount, revenueSum, pendingPayoutSum, paidOutSum] = await Promise.all([
    prisma.user.count(),
    prisma.post.count(),
    prisma.user.count({ where: { tier: "PRIME" } }),
    prisma.user.count({ where: { tier: "PLUS" } }),
    prisma.transaction.aggregate({ where: { status: "success" }, _sum: { amount: true } }),
    prisma.payout.aggregate({ where: { status: "pending" }, _sum: { amount: true } }),
    prisma.payout.aggregate({ where: { status: "paid" }, _sum: { amount: true } }),
  ])

  return NextResponse.json({
    userCount,
    postCount,
    primeCount,
    plusCount,
    revenuePesewas: revenueSum._sum.amount || 0,
    pendingPayoutPesewas: pendingPayoutSum._sum.amount || 0,
    paidOutPesewas: paidOutSum._sum.amount || 0,
  })
}