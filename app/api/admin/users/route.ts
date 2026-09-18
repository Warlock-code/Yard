import { NextRequest, NextResponse } from "next/server"
import { prisma } from "@/lib/prisma"
import { isAdmin } from "@/lib/getAdmin"

export const dynamic = "force-dynamic"

export async function GET(req: NextRequest) {
  if (!isAdmin(req)) return NextResponse.json({ error: "Not authorized." }, { status: 403 })

  const { searchParams } = new URL(req.url)
  const search = searchParams.get("search") || ""

  const users = await prisma.user.findMany({
    where: search ? { ghostId: { contains: search, mode: "insensitive" } } : {},
    orderBy: { createdAt: "desc" },
    take: 30,
    select: { id: true, ghostId: true, email: true, campus: true, tier: true, createdAt: true },
  })

  return NextResponse.json({ users })
}