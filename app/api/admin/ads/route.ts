import { NextRequest, NextResponse } from "next/server"
import { randomBytes } from "crypto"
import { prisma } from "@/lib/prisma"
import { isAdmin } from "@/lib/getAdmin"

export const dynamic = "force-dynamic"

const SPONSOR_EMAIL = "sponsor@yardapp.me"
const DEFAULT_AD_DURATION_HOURS = 24
const MAX_AD_DURATION_HOURS = 30 * 24

/** Accepts 24, "24", "24h", "24 hours" — returns a sane hour count. */
function parseDurationHours(value: unknown): number {
  if (value === null || value === undefined || value === "") return DEFAULT_AD_DURATION_HOURS
  const raw = typeof value === "number" ? value : Number(String(value).trim().replace(/h(ou)?rs?$/i, ""))
  if (!Number.isFinite(raw) || raw <= 0) return DEFAULT_AD_DURATION_HOURS
  return Math.min(Math.max(Math.round(raw), 1), MAX_AD_DURATION_HOURS)
}

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
 * into the first feed page at a tier-based interval (FREE 3 / PLUS 8 /
 * PRIME 50). Each ad expires after its campaign window. Not a self-serve
 * platform — this is the only writer of isAd posts.
 */
export async function POST(req: NextRequest) {
  if (!isAdmin(req)) return NextResponse.json({ error: "not authorized." }, { status: 403 })

  const body = await req.json()
  const { text: rawText, imageUrl: rawImageUrl, adLink: rawAdLink } = body
  const text = typeof rawText === "string" ? rawText.trim() : ""
  const imageUrl = typeof rawImageUrl === "string" ? rawImageUrl.trim() : ""
  const adLink = typeof rawAdLink === "string" ? rawAdLink.trim() : ""
  // Admins choose a campaign window (24h / 48h / 72h in the UI, any hour
  // count up to 30 days via the API). Expired ads are filtered out of feeds.
  const durationHours = parseDurationHours(
    body.expirationHours ?? body.durationHours ?? body.expiresInHours ?? body.duration
  )
  const adExpiresAt = new Date(Date.now() + durationHours * 60 * 60 * 1000)

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
      adExpiresAt,
      isAd: true,
      type: "confession",
      campus: "ALL",
      visibility: "school",
    },
    include: adInclude,
  })
  return NextResponse.json({ post })
}
