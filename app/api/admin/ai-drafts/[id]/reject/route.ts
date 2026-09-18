import { NextRequest, NextResponse } from "next/server"
import { prisma } from "@/lib/prisma"
import { isAdmin } from "@/lib/getAdmin"

export const dynamic = "force-dynamic"
export const revalidate = 0
export const fetchCache = "force-no-store"

export async function POST(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  if (!isAdmin(req)) return NextResponse.json({ error: "Not authorized." }, { status: 403 })
  const { id } = await params

  await prisma.aiDraft.update({ where: { id }, data: { status: "rejected" } })
  return NextResponse.json({ success: true })
}