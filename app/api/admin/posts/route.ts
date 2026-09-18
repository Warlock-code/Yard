import { NextRequest, NextResponse } from "next/server"
import { prisma } from "@/lib/prisma"
import { isAdmin } from "@/lib/getAdmin"

export const dynamic = "force-dynamic"

export async function GET(req: NextRequest) {
  if (!isAdmin(req)) return NextResponse.json({ error: "Not authorized." }, { status: 403 })

  const { searchParams } = new URL(req.url)
  const search = searchParams.get("search") || ""

  const posts = await prisma.post.findMany({
    where: search ? { text: { contains: search, mode: "insensitive" } } : {},
    orderBy: { createdAt: "desc" },
    take: 30,
    include: { user: { select: { ghostId: true } } },
  })

  return NextResponse.json({ posts })
}