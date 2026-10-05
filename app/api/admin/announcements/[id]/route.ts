import { NextRequest, NextResponse } from "next/server"
import { prisma } from "@/lib/prisma"
import { isAdmin } from "@/lib/getAdmin"

export const dynamic = "force-dynamic"

// Takedown: archive the announcement so it leaves every feed.
// (Reversible from the database; no hard delete.)
export async function DELETE(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  if (!isAdmin(req)) return NextResponse.json({ error: "not authorized." }, { status: 403 })
  const { id } = await params
  const existing = await prisma.post.findUnique({ where: { id } })
  if (!existing || existing.type !== "announcement") {
    return NextResponse.json({ error: "announcement not found." }, { status: 404 })
  }
  await prisma.post.update({ where: { id }, data: { archived: true } })
  return NextResponse.json({ ok: true })
}
