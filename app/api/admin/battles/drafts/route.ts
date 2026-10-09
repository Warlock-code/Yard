import { NextRequest, NextResponse } from "next/server"
import { prisma } from "@/lib/prisma"
import { isAdmin } from "@/lib/getAdmin"

export const dynamic = "force-dynamic"
export const revalidate = 0
export const fetchCache = "force-no-store"

// Dormant battle drafts (UPCOMING with a future startsAt — e.g. the seeded
// campus packs). Launching is a separate, deliberate tap from creating.
export async function GET(req: NextRequest) {
  if (!isAdmin(req)) {
    return NextResponse.json({ error: "not authorized." }, { status: 403 })
  }
  const drafts = await prisma.battlePrompt.findMany({
    where: { status: "UPCOMING" },
    orderBy: [{ campus: "asc" }, { startsAt: "asc" }],
    select: {
      id: true,
      text: true,
      campus: true,
      type: true,
      startsAt: true,
      endsAt: true,
      createdAt: true,
      _count: { select: { entries: true } },
    },
  })
  return NextResponse.json({ drafts })
}

export async function DELETE(req: NextRequest) {
  if (!isAdmin(req)) {
    return NextResponse.json({ error: "not authorized." }, { status: 403 })
  }
  const id = new URL(req.url).searchParams.get("id")
  if (!id) return NextResponse.json({ error: "id required." }, { status: 400 })
  const draft = await prisma.battlePrompt.findUnique({ where: { id }, select: { id: true, status: true } })
  if (!draft) return NextResponse.json({ error: "draft not found." }, { status: 404 })
  if (draft.status !== "UPCOMING") {
    return NextResponse.json({ error: "only upcoming drafts can be deleted." }, { status: 400 })
  }
  await prisma.battlePrompt.delete({ where: { id } })
  return NextResponse.json({ success: true })
}
