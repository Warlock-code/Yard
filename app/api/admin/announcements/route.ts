import { NextRequest, NextResponse } from "next/server"
import { randomBytes } from "crypto"
import { prisma } from "@/lib/prisma"
import { isAdmin } from "@/lib/getAdmin"

export const dynamic = "force-dynamic"

const OFFICIAL_EMAIL = "official@yardapp.me"

/** The system author for admin announcements. Created lazily on first post. */
export async function getOfficialUser() {
  return prisma.user.upsert({
    where: { email: OFFICIAL_EMAIL },
    update: {},
    create: {
      email: OFFICIAL_EMAIL,
      passwordHash: randomBytes(32).toString("hex"),
      campus: "ALL",
      ghostId: "yard",
      avatarEmoji: "📢",
      inviteCode: "official-yard",
    },
  })
}

const announcementInclude = {
  user: {
    select: {
      id: true,
      ghostId: true,
      avatarEmoji: true,
      tier: true,
      tierExpiresAt: true,
      campus: true,
    },
  },
} as const

export async function GET(req: NextRequest) {
  if (!isAdmin(req)) return NextResponse.json({ error: "not authorized." }, { status: 403 })
  const announcements = await prisma.post.findMany({
    where: { type: "announcement", archived: false },
    orderBy: { createdAt: "desc" },
    include: announcementInclude,
  })
  return NextResponse.json({ announcements })
}

export async function POST(req: NextRequest) {
  if (!isAdmin(req)) return NextResponse.json({ error: "not authorized." }, { status: 403 })

  const { text: rawText, campus: rawCampus } = await req.json()
  const text = typeof rawText === "string" ? rawText.trim() : ""
  if (!text) return NextResponse.json({ error: "announcement needs text." }, { status: 400 })
  if (text.length > 2000) {
    return NextResponse.json({ error: "announcement must be 2000 characters or fewer." }, { status: 400 })
  }
  const campus = typeof rawCampus === "string" && rawCampus.trim() ? rawCampus.trim() : "ALL"

  const official = await getOfficialUser()
  const post = await prisma.post.create({
    data: {
      userId: official.id,
      text,
      type: "announcement",
      campus,
      visibility: "school",
    },
    include: announcementInclude,
  })
  return NextResponse.json({ post })
}
