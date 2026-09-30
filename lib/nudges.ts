import { prisma } from "@/lib/prisma"
import { createNotification } from "@/lib/notifications"

export const DEFAULT_AVATAR = "👻"

// Snapchat-style: aggressive but still deduped. NOT 1/day —
// we allow up to 8 nudges/day with a short gap so it feels alive
// like Snapchat, without sending the exact same nudge twice in a row.
export const MAX_NUDGES_PER_DAY = 8
export const MIN_GAP_MINUTES = 30

export type NudgeType =
  | "nudge_boost_popping"
  | "nudge_avatar"
  | "nudge_streak_freeze"
  | "nudge_plus"
  | "nudge_custom_name"
  | "nudge_first_buy"
  | "nudge_storage"
  | "nudge_comeback"

// Per-type cooldowns (hours). Boost is per-post, rest are per-user.
export const NUDGE_COOLDOWN_HOURS: Record<NudgeType, number> = {
  nudge_boost_popping: 6,
  nudge_avatar: 24,
  nudge_streak_freeze: 20,
  nudge_plus: 48,
  nudge_custom_name: 72,
  nudge_first_buy: 24,
  nudge_storage: 48,
  nudge_comeback: 72,
}

export type NudgeCopy = {
  title: string
  body: string
  href: string
  icon: string
}

export function getNudgeCopy(
  type: NudgeType,
  opts: { postId?: string; count?: number; name?: string } = {}
): NudgeCopy {
  switch (type) {
    case "nudge_boost_popping":
      return {
        title: "your post is popping 🚀",
        body: `your post is popping with ${opts.count ?? "lots of"} heat — boost it for 24h for GHS 3.`,
        href: opts.postId ? `/post/${opts.postId}?nudge=boost` : "/feed?nudge=boost",
        icon: "🚀",
      }
    case "nudge_avatar":
      return {
        title: "people are checking you 👀",
        body:
          opts.count && opts.count > 1
            ? `${opts.count} ghosts checked your profile — you're still 👻. Upgrade your avatar to stand out.`
            : `Someone checked your profile — you're still 👻. Upgrade your avatar to stand out.`,
        href: "/shop?nudge=avatar",
        icon: "🎭",
      }
    case "nudge_streak_freeze":
      return {
        title: "streak about to break 🔥",
        body: `your ${opts.count ?? ""} day streak goes cold soon. Freeze it for 200 credits.`.trim(),
        href: "/shop?nudge=freeze",
        icon: "🧊",
      }
    case "nudge_plus":
      return {
        title: "unlock Plus ✨",
        body: "you keep hitting Plus-only perks — edit posts, blue tick + 1 free boost weekly for GHS 10/mo.",
        href: "/upgrade?nudge=plus",
        icon: "✨",
      }
    case "nudge_custom_name":
      return {
        title: "your name is forgettable ✏️",
        body: `${opts.name ?? "your ghost name"} won't stick. Custom ghost name for GHS 3 — make the yard know you.`,
        href: "/lair?nudge=name",
        icon: "✏️",
      }
    case "nudge_first_buy":
      return {
        title: "first buy discount 🎁",
        body: "you've never bought anything — first purchase is 20% off tonight only. Boost, avatar, freeze.",
        href: "/shop?nudge=firstbuy",
        icon: "🎁",
      }
    case "nudge_storage":
      return {
        title: "storage almost full 💾",
        body: "you're almost out of media space. +100MB for 200 credits so your next post doesn't fail.",
        href: "/shop?nudge=storage",
        icon: "💾",
      }
    case "nudge_comeback":
      return {
        title: "the yard misses you 👻",
        body: "you haven't posted in days — drop one gist and watch the heat come back.",
        href: "/compose?nudge=comeback",
        icon: "👻",
      }
  }
}

async function getRecentNudges(userId: string, since: Date) {
  return prisma.notification.findMany({
    where: { userId, type: { startsWith: "nudge_" }, createdAt: { gte: since } },
    orderBy: { createdAt: "desc" },
    select: { id: true, type: true, href: true, createdAt: true },
    take: 20,
  })
}

export async function canSendNudge(
  userId: string,
  type: NudgeType,
  opts: { postId?: string } = {}
): Promise<{ ok: boolean; reason?: string }> {
  const now = new Date()
  const dayAgo = new Date(now.getTime() - 24 * 60 * 60 * 1000)
  const recent = await getRecentNudges(userId, dayAgo)

  // Daily cap — Snapchat-level (8/day), not 1/day
  if (recent.length >= MAX_NUDGES_PER_DAY) {
    return { ok: false, reason: "daily-cap" }
  }

  // Minimum gap between ANY two nudges — 30 min so it feels frequent but not instant-spam
  if (recent.length > 0) {
    const lastAt = new Date(recent[0].createdAt).getTime()
    if (now.getTime() - lastAt < MIN_GAP_MINUTES * 60 * 1000) {
      return { ok: false, reason: "too-soon" }
    }
  }

  // Per-type cooldown (per-post for boost)
  const cooldownH = NUDGE_COOLDOWN_HOURS[type]
  const cutoff = new Date(now.getTime() - cooldownH * 60 * 60 * 1000)
  const sameType = recent.filter((n) => {
    if (n.type !== type) return false
    if (type === "nudge_boost_popping" && opts.postId) {
      return n.href.includes(opts.postId) && new Date(n.createdAt) > cutoff
    }
    return new Date(n.createdAt) > cutoff
  })
  // Fallback: check beyond 24h window for long cooldowns (48h/72h)
  if (sameType.length === 0 && cooldownH > 24) {
    const existing = await prisma.notification.findFirst({
      where: { userId, type, createdAt: { gte: cutoff } },
      select: { id: true },
    })
    if (existing) return { ok: false, reason: "type-cooldown" }
  } else if (sameType.length > 0) {
    return { ok: false, reason: "type-cooldown" }
  }

  return { ok: true }
}

export async function maybeSendNudge(
  userId: string,
  type: NudgeType,
  opts: { postId?: string; count?: number; name?: string } = {}
) {
  const gate = await canSendNudge(userId, type, opts)
  if (!gate.ok) return null
  const copy = getNudgeCopy(type, opts)
  try {
    return await createNotification({
      userId,
      type,
      title: copy.title,
      body: copy.body,
      href: copy.href,
    })
  } catch {
    return null
  }
}

// --- Event triggers -------------------------------------------------

/** Called after a vote lands. Fires boost nudge when post is heating up. */
export async function evalHotPostNudge(postId: string) {
  const post = await prisma.post.findUnique({
    where: { id: postId },
    select: { id: true, userId: true, yeahs: true, boostedUntil: true, createdAt: true },
  })
  if (!post) return null
  if (post.boostedUntil && post.boostedUntil > new Date()) return null // already boosted
  if (post.yeahs < 5) return null

  // Velocity: votes in last 60 mins — hot if >= 3 recent OR milestone total
  const hourAgo = new Date(Date.now() - 60 * 60 * 1000)
  const recentVotes = await prisma.postVote.count({
    where: { postId, createdAt: { gte: hourAgo } },
  })
  const isHot = recentVotes >= 3 || [5, 10, 25, 50, 100, 500].includes(post.yeahs)
  if (!isHot) return null

  return maybeSendNudge(post.userId, "nudge_boost_popping", {
    postId: post.id,
    count: post.yeahs,
  })
}

/** Called after someone views a profile. Fires avatar nudge for default-👻 owners getting traffic. */
export async function evalProfileAvatarNudge(profileOwnerId: string) {
  const owner = await prisma.user.findUnique({
    where: { id: profileOwnerId },
    select: { id: true, avatarEmoji: true, tier: true },
  })
  if (!owner) return null
  if (owner.avatarEmoji !== DEFAULT_AVATAR) return null // only default ghosts

  const dayAgo = new Date(Date.now() - 24 * 60 * 60 * 1000)
  const views = await prisma.notification.count({
    where: { userId: profileOwnerId, type: "profile_view", createdAt: { gte: dayAgo } },
  })
  if (views < 2) return null // need at least 2 views in 24h to trigger

  return maybeSendNudge(profileOwnerId, "nudge_avatar", { count: views })
}

/**
 * On-demand eval for slow-burn nudges (streak, storage, plus, first-buy, name, comeback).
 * Called from GET /api/nudges — creates at most 2 per call so one refresh
 * doesn't dump 6 notifications at once (Snapchat drip, not flood).
 */
export async function evalUserNudges(userId: string) {
  const user = await prisma.user.findUnique({ where: { id: userId } })
  if (!user || user.status !== "ACTIVE") return []
  const created: string[] = []
  const trySend = async (type: NudgeType, opts: { count?: number; name?: string } = {}) => {
    if (created.length >= 2) return
    const n = await maybeSendNudge(userId, type, opts)
    if (n) created.push(type)
  }

  const now = Date.now()

  // 1. Streak at risk: streak >= 2, no post in 18h+, no freeze shield
  if (user.streakCount >= 2 && user.lastPostedAt) {
    const hoursSincePost = (now - new Date(user.lastPostedAt).getTime()) / 3_600_000
    const frozen = user.streakFreezeUntil && new Date(user.streakFreezeUntil) > new Date()
    if (hoursSincePost >= 18 && !frozen) {
      await trySend("nudge_streak_freeze", { count: user.streakCount })
    }
  }

  // 2. Storage 80%+ full
  const limit = user.storageLimit || 50
  if (limit > 0 && user.storageUsed / limit >= 0.8) {
    await trySend("nudge_storage")
  }

  // 3. Comeback: no post in 7+ days but had posted before
  if (user.lastPostedAt) {
    const daysSince = (now - new Date(user.lastPostedAt).getTime()) / 86_400_000
    if (daysSince >= 7) await trySend("nudge_comeback")
  }

  // 4. Plus: FREE user hitting paywalls (2+ hits in 7d)
  if (user.tier === "FREE") {
    const weekAgo = new Date(now - 7 * 24 * 60 * 60 * 1000)
    const hits = await prisma.paywallHit.count({
      where: { userId: user.id, createdAt: { gte: weekAgo } },
    }).catch(() => 0)
    if (hits >= 2) await trySend("nudge_plus")

    // 5. First buy: account 2+ days old, never paid successfully
    const ageDays = (now - new Date(user.createdAt).getTime()) / 86_400_000
    if (ageDays >= 2 && created.length < 2) {
      const paid = await prisma.transaction.count({
        where: { userId: user.id, status: "success" },
      })
      if (paid === 0) await trySend("nudge_first_buy")
    }

    // 6. Custom name: random ghost_xxxx name + has followers
    if (created.length < 2 && /^ghost_/i.test(user.ghostId)) {
      const followers = await prisma.follow.count({ where: { followingId: user.id } })
      if (followers >= 5) await trySend("nudge_custom_name", { name: user.ghostId })
    }
  }

  // 7. Default avatar with posts (catch-all even without profile views)
  if (created.length < 2 && user.avatarEmoji === DEFAULT_AVATAR) {
    const posts = await prisma.post.count({ where: { userId: user.id } })
    if (posts >= 3) await trySend("nudge_avatar")
  }

  return created
}
