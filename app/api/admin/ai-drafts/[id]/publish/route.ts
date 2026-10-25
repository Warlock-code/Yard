import { NextRequest, NextResponse } from "next/server"
import { prisma } from "@/lib/prisma"
import { isAdmin } from "@/lib/getAdmin"
import { CAMPUSES } from "@/lib/schoolEmails"

export const dynamic = "force-dynamic"
export const revalidate = 0
export const fetchCache = "force-no-store"

const SYSTEM_GHOST_EMAIL = "system@yardapp.me"

export async function POST(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  if (!isAdmin(req)) return NextResponse.json({ error: "not authorized." }, { status: 403 })
  const { id } = await params
  const body = await req.json().catch(() => ({}))
  // Optional campus override so AI drafts are not locked to GCTU. An invalid
  // value is rejected instead of silently publishing into the wrong feed.
  const requestedCampus = typeof body.campus === "string" ? body.campus.trim() : ""
  const campus = requestedCampus || "GCTU"
  if (!CAMPUSES.includes(campus)) {
    return NextResponse.json({ error: "invalid campus." }, { status: 400 })
  }

  const draft = await prisma.aiDraft.findUnique({ where: { id } })
  if (!draft) return NextResponse.json({ error: "not found." }, { status: 404 })
  if (draft.status !== "pending") return NextResponse.json({ error: "draft already processed." }, { status: 409 })

  let systemUser = await prisma.user.findUnique({ where: { email: SYSTEM_GHOST_EMAIL } })
  if (!systemUser) {
    try {
      systemUser = await prisma.user.create({
        data: {
          email: SYSTEM_GHOST_EMAIL,
          passwordHash: "not_a_real_account",
          emailVerified: true,
          campus,
          ghostId: "CampusWire",
          avatarEmoji: "📡",
        },
      })
    } catch (e: any) {
      if (e?.code === "P2002") {
        systemUser = await prisma.user.findUnique({ where: { email: SYSTEM_GHOST_EMAIL } })
        if (!systemUser) return NextResponse.json({ error: "system user conflict." }, { status: 500 })
      } else throw e
    }
  }

  await prisma.post.create({
    data: {
      userId: systemUser.id,
      text: draft.text.toLowerCase(),
      type: "confession",
      campus,
      visibility: "school",
    },
  })

  await prisma.aiDraft.update({ where: { id }, data: { status: "published" } })

  return NextResponse.json({ success: true })
}