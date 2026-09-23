import { prisma } from "@/lib/prisma"

// Per-campus rotating battle champion:
// - CampusChampion holds the single current holder per campus (trophy moves on each win)
// - CampusBattleWin tracks all-time wins per user per campus (trophy count = holder's wins)

export async function recordBattleWin(userId: string, campus: string) {
  const win = await prisma.campusBattleWin.upsert({
    where: { userId_campus: { userId, campus } },
    create: { userId, campus, wins: 1 },
    update: { wins: { increment: 1 } },
  })
  await prisma.campusChampion.upsert({
    where: { campus },
    create: { campus, userId },
    update: { userId, wonAt: new Date() },
  })
  return win.wins
}

type UserRef = { id: string; campus?: string | null }

export async function getChampionTrophies(
  users: UserRef[]
): Promise<Map<string, number>> {
  const result = new Map<string, number>()
  if (users.length === 0) return result

  const campuses = [...new Set(users.map((u) => u.campus).filter((c): c is string => Boolean(c)))]
  if (campuses.length === 0) return result

  const champions = await prisma.campusChampion.findMany({
    where: { campus: { in: campuses } },
    select: { campus: true, userId: true },
  })
  const champByCampus = new Map(champions.map((c) => [c.campus, c.userId]))
  if (champByCampus.size === 0) return result

  // Only current holders show trophies. Collect champ (userId, campus) pairs.
  const champPairs = users.filter((u) => u.campus && champByCampus.get(u.campus) === u.id)
  if (champPairs.length === 0) return result

  const wins = await prisma.campusBattleWin.findMany({
    where: {
      OR: champPairs.map((u) => ({ userId: u.id, campus: u.campus! })),
    },
    select: { userId: true, campus: true, wins: true },
  })
  for (const w of wins) {
    // key by userId (a user belongs to one campus, so no collision)
    result.set(w.userId, w.wins)
  }
  // Fallback: holder without a win row (legacy data) still shows 1
  for (const u of champPairs) {
    if (!result.has(u.id)) result.set(u.id, 1)
  }
  return result
}

// Mutates each item's `.user` to include `championTrophies` (0 when not holder).
export async function attachChampionTrophies<T extends { user?: { id: string; campus?: string | null } | null }>(
  items: T[]
): Promise<T[]> {  const refs: UserRef[] = []
  for (const item of items) {
    if (item.user?.id) refs.push({ id: item.user.id, campus: item.user.campus ?? null })
  }
  // Need campus for users missing it — fetch once.
  const missingCampusIds = [...new Set(refs.filter((r) => !r.campus).map((r) => r.id))]
  let campusById = new Map<string, string>()
  if (missingCampusIds.length > 0) {
    const rows = await prisma.user.findMany({
      where: { id: { in: missingCampusIds } },
      select: { id: true, campus: true },
    })
    campusById = new Map(rows.map((r) => [r.id, r.campus]))
    for (const r of refs) {
      if (!r.campus) {
        const c = campusById.get(r.id)
        if (c) r.campus = c
      }
    }
  }
  const trophies = await getChampionTrophies(refs)
  for (const item of items) {
    if (item.user && typeof item.user === "object") {
      ;(item.user as Record<string, unknown>).championTrophies = trophies.get(item.user.id) ?? 0
    }
  }
  return items
}

// Recursively finds every `{ user: { id } }` in an object/array and attaches
// `championTrophies`. Use for nested shapes (battles with entries/winners/rounds,
// comments with replies, posts with user).
export async function attachChampionTrophiesDeep<T>(root: T): Promise<T> {
  const holders: { user: { id: string; campus?: string | null } }[] = []
  const seen = new Set<unknown>()
  const visit = (node: unknown) => {
    if (!node || typeof node !== "object" || seen.has(node)) return
    seen.add(node)
    if (Array.isArray(node)) {
      for (const el of node) visit(el)
      return
    }
    const rec = node as Record<string, unknown>
    const u = rec.user
    if (u && typeof u === "object" && typeof (u as Record<string, unknown>).id === "string") {
      holders.push(node as { user: { id: string; campus?: string | null } })
    }
    for (const v of Object.values(rec)) visit(v)
  }
  visit(root)
  await attachChampionTrophies(holders)
  return root
}
