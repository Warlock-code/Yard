import { NextRequest, NextResponse } from "next/server"
import { prisma } from "@/lib/prisma"
import { getCurrentUser } from "@/lib/getCurrentUser"
import { AVATAR_EMOJI_MAP } from "@/lib/avatars"
import { getEffectiveTier, getTierAvatars } from "@/lib/tier"
import type { AccountTier } from "@prisma/client"

export const dynamic = "force-dynamic"

const DEFAULT_AVATAR_EMOJI = "👻"

/** Free-with-tier avatars must match `lib/avatars.ts`'s `common` rarity set
 *  (via `getTierAvatars`), so what a user can equip is consistent with what
 *  the Shop/Owned pages advertise as unlocked-for-your-tier. */
function unlockedSet(user: { tier: AccountTier; tierExpiresAt: Date | null; ownedCosmetics: string[] }) {
  const set = new Set<string>([DEFAULT_AVATAR_EMOJI])
  const effectiveTier = getEffectiveTier(user)
  for (const avatarId of getTierAvatars(effectiveTier)) {
    const emoji = AVATAR_EMOJI_MAP[avatarId]
    if (emoji) set.add(emoji)
  }
  user.ownedCosmetics.forEach((id: string) => {
    const emoji = AVATAR_EMOJI_MAP[id]
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