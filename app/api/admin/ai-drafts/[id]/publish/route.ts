import { NextRequest, NextResponse } from "next/server"
import { prisma } from "@/lib/prisma"
import { isAdmin } from "@/lib/getAdmin"

export const dynamic = "force-dynamic"
export const revalidate = 0
export const fetchCache = "force-no-store"

const SYSTEM_GHOST_EMAIL = "system@yardapp.me"

export async function POST(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  if (!isAdmin(req)) return NextResponse.json({ error: "Not authorized." }, { status: 403 })
  const { id } = await params

  const draft = await prisma.aiDraft.findUnique({ where: { id } })
  if (!draft) return NextResponse.json({ error: "Not found." }, { status: 404 })
  if (draft.status !== "pending") return NextResponse.json({ error: "Draft already processed." }, { status: 409 })

  let systemUser = await prisma.user.findUnique({ where: { email: SYSTEM_GHOST_EMAIL } })
  if (!systemUser) {
    try {
      systemUser = await prisma.user.create({
        data: {
          email: SYSTEM_GHOST_EMAIL,
          passwordHash: "not_a_real_account",
          emailVerified: true,
          campus: "GCTU",
          ghostId: "CampusWire",
          avatarEmoji: "📡",
        },
      })
    } catch (e: any) {
      if (e?.code === "P2002") {
        systemUser = await prisma.user.findUnique({ where: { email: SYSTEM_GHOST_EMAIL } })
        if (!systemUser) return NextResponse.json({ error: "System user conflict." }, { status: 500 })
      } else throw e
    }
  }

  await prisma.post.create({
    data: {
      userId: systemUser.id,
      text: draft.text.toLowerCase(),
      type: "confession",
      campus: "GCTU",
      visibility: "school",
    },
  })

  await prisma.aiDraft.update({ where: { id }, data: { status: "published" } })

  return NextResponse.json({ success: true })
}