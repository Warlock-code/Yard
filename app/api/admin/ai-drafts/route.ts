import { NextRequest, NextResponse } from "next/server"
import { prisma } from "@/lib/prisma"
import { isAdmin } from "@/lib/getAdmin"

export async function GET(req: NextRequest) {
  if (!isAdmin(req)) return NextResponse.json({ error: "Not authorized." }, { status: 403 })

  const drafts = await prisma.aiDraft.findMany({ where: { status: "pending" }, orderBy: { createdAt: "desc" } })
  return NextResponse.json({ drafts })
}