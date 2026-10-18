import { NextRequest, NextResponse } from "next/server"
import { randomBytes } from "crypto"
import { prisma } from "@/lib/prisma"
import { isAdmin } from "@/lib/getAdmin"

export const dynamic = "force-dynamic"

const SPONSOR_EMAIL = "sponsor@yardapp.me"

/** The system author for manual ads. Created lazily on first ad. */
async function getSponsorUser() {
  return prisma.user.upsert({
    where: { email: SPONSOR_EMAIL },
    update: {},
    create: {
      email: SPONSOR_EMAIL,
      passwordHash: randomBytes(32).toString("hex"),
      campus: "ALL",
      ghostId: "Yard Sponsor",
      avatarEmoji: "📣",
      inviteCode: "yard-sponsor",
    },
  })
}

const adInclude = {
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

/**
 * Manual native ads (Phase 1): admin-authored sponsored posts injected
 * into the main feed every 5 posts. Not a self-serve platform — this is
 * the only writer of isAd posts.
 */
export async function POST(req: NextRequest) {
  if (!isAdmin(req)) return NextResponse.json({ error: "not authorized." }, { status: 403 })

  const { text: rawText, imageUrl: rawImageUrl, adLink: rawAdLink } = await req.json()
  const text = typeof rawText === "string" ? rawText.trim() : ""
  const imageUrl = typeof rawImageUrl === "string" ? rawImageUrl.trim() : ""
  const adLink = typeof rawAdLink === "string" ? rawAdLink.trim() : ""

  if (!text && !imageUrl) {
    return NextResponse.json({ error: "ad needs text or an image." }, { status: 400 })
  }
  if (text.length > 2000) {
    return NextResponse.json({ error: "ad text must be 2000 characters or fewer." }, { status: 400 })
  }
  if (imageUrl && imageUrl.length > 2048) {
    return NextResponse.json({ error: "image URL is invalid." }, { status: 400 })
  }
  if (imageUrl && !/^https?:\/\//i.test(imageUrl) && !imageUrl.startsWith("/")) {
    return NextResponse.json({ error: "image URL is invalid." }, { status: 400 })
  }
  if (adLink && !/^https?:\/\//i.test(adLink)) {
    return NextResponse.json({ error: "target link must start with http:// or https://." }, { status: 400 })
  }

  const sponsor = await getSponsorUser()
  const post = await prisma.post.create({
    data: {
      userId: sponsor.id,
      text: text || null,
      imageUrl: imageUrl || null,
      adLink: adLink || null,
      isAd: true,
      type: "confession",
      campus: "ALL",
      visibility: "school",
    },
    include: adInclude,
  })
  return NextResponse.json({ post })
}
