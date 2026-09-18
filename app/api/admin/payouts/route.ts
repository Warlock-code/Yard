import { NextRequest, NextResponse } from "next/server"
import { prisma } from "@/lib/prisma"
import { isAdmin } from "@/lib/getAdmin"
import { decrypt } from "@/lib/payoutEncryption"

export const dynamic = "force-dynamic"

export async function GET(req: NextRequest) {
  if (!isAdmin(req)) {
    return NextResponse.json({ error: "Not authorized." }, { status: 403 })
  }

  const { searchParams } = new URL(req.url)
  const status = searchParams.get("status")
  // default: show pending + processing + approved (in-flight). Use ?status=all for all, ?status=pending etc.
  let where: any = {}
  if (status === "all") where = {}
  else if (status === "pending" || status === "processing" || status === "approved" || status === "paid" || status === "rejected") where = { status }
  else where = { status: { in: ["pending", "processing", "approved"] } }

  const payouts = await prisma.payout.findMany({
    where,
    orderBy: { requestedAt: "desc" },
    include: { user: { select: { ghostId: true, email: true } } },
  })

  const decoded = payouts.map((p) => {
    let accountName: string | null = p.accountName
    let accountNumber: string | null = p.accountNumber
    let bankCode: string | null = p.bankCode
    try { if (p.accountName) accountName = decrypt(p.accountName) } catch {}
    try { if (p.accountNumber) accountNumber = decrypt(p.accountNumber) } catch {}
    try { if (p.bankCode) bankCode = decrypt(p.bankCode) } catch {}
    return { ...p, accountName, accountNumber, bankCode }
  })

  return NextResponse.json({ payouts: decoded })
}