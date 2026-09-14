import { NextRequest, NextResponse } from "next/server"
import { prisma } from "@/lib/prisma"
import { getCurrentUser } from "@/lib/getCurrentUser"

const TIER_AVATARS: Record<string, string[]> = {
  FREE: ["👻"],
  PLUS: ["👻", "🐍", "👽"],
  PRIME: ["👻", "🐍", "👽", "🧙", "🦇", "🕷️", "😂"],
}

export async function POST(req: NextRequest) {
  const user = await getCurrentUser(req)
  if (!user) return NextResponse.json({ error: "Not authenticated." }, { status: 401 })

  const { emoji } = await req.json()
  const allowed = TIER_AVATARS[user.tier] || TIER_AVATARS.FREE

  if (!allowed.includes(emoji)) {
    return NextResponse.json({ error: "Not unlocked at your tier." }, { status: 403 })
  }

  await prisma.user.update({ where: { id: user.id }, data: { avatarEmoji: emoji } })

  return NextResponse.json({ success: true, avatarEmoji: emoji })
}

export async function GET(req: NextRequest) {
  const user = await getCurrentUser(req)
  if (!user) return NextResponse.json({ error: "Not authenticated." }, { status: 401 })

  return NextResponse.json({ available: TIER_AVATARS[user.tier] || TIER_AVATARS.FREE })
}