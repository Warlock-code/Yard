import { NextRequest, NextResponse } from "next/server"
import { prisma } from "@/lib/prisma"
import { isAdmin } from "@/lib/getAdmin"

export async function DELETE(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  if (!isAdmin(req)) return NextResponse.json({ error: "Not authorized." }, { status: 403 })
  const { id } = await params

  await prisma.user.delete({ where: { id } })
  return NextResponse.json({ success: true })
}