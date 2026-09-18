import { NextRequest, NextResponse } from "next/server"
import { prisma } from "@/lib/prisma"
import { isAdmin } from "@/lib/getAdmin"

export const dynamic = "force-dynamic"
export const revalidate = 0
export const fetchCache = "force-no-store"

export async function POST(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  if (!isAdmin(req)) return NextResponse.json({ error: "Not authorized." }, { status: 403 })
  const { id } = await params

  try {
    await prisma.aiDraft.update({ where: { id }, data: { status: "rejected" } })
    return NextResponse.json({ success: true })
  } catch (e: any) {
    if (e?.code === "P2025") return NextResponse.json({ error: "Draft not found." }, { status: 404 })
    return NextResponse.json({ error: "Failed to reject." }, { status: 500 })
  }
}