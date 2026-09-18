import { NextRequest, NextResponse } from "next/server"
import { prisma } from "@/lib/prisma"
import { getCurrentUser } from "@/lib/getCurrentUser"
import { AVATAR_EMOJI_MAP } from "@/lib/avatars"

export const dynamic = "force-dynamic"

const TIER_AVATARS: Record<string, string[]> = {
  FREE: ["👻"],
  PLUS: ["👻", "🐍", "👽"],
  PRIME: ["👻", "🐍", "👽", "🧙", "🦇", "🕷️", "😂"],
}

const COSMETIC_EMOJI_MAP = AVATAR_EMOJI_MAP

function unlockedSet(user: { tier: string; ownedCosmetics: string[] }) {
  const set = new Set(TIER_AVATARS[user.tier] || TIER_AVATARS.FREE)
  user.ownedCosmetics.forEach((id: string) => {
    const emoji = COSMETIC_EMOJI_MAP[id]
    if (emoji) set.add(emoji)
  })
  return set
}

export async function POST(req: NextRequest) {
  const user = await getCurrentUser(req)
  if (!user) return NextResponse.json({ error: "Not authenticated." }, { status: 401 })

  const { emoji } = await req.json()
  if (!unlockedSet(user).has(emoji)) {
    return NextResponse.json({ error: "Not unlocked yet." }, { status: 403 })
  }

  await prisma.user.update({ where: { id: user.id }, data: { avatarEmoji: emoji } })
  return NextResponse.json({ success: true, avatarEmoji: emoji })
}

export async function GET(req: NextRequest) {
  const user = await getCurrentUser(req)
  if (!user) return NextResponse.json({ error: "Not authenticated." }, { status: 401 })

  return NextResponse.json({ available: Array.from(unlockedSet(user)) })
}