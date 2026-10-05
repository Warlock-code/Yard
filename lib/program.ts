import type { Prisma } from "@prisma/client"

export type ProgramIdentity = {
  campus: string
  program?: string | null
  cohortYear?: number | null
}

function validCohortYear(value: unknown): number | null {
  return typeof value === "number" && Number.isInteger(value) && value >= 2000 && value <= 2100 ? value : null
}

export function normalizeProgram(value: unknown): string | null {
  if (typeof value !== "string") return null
  return value.normalize("NFKC").trim().replace(/\s+/gu, " ").toLowerCase() || null
}

export function getProgramKey(campus: unknown, program: unknown, cohortYear?: unknown): string | null {
  const normalizedCampus = normalizeProgram(campus)
  const normalizedProgram = normalizeProgram(program)
  if (!normalizedCampus || !normalizedProgram) return null
  const cohort = validCohortYear(cohortYear)
  // Cohort-scoped key: one class feed per school+program+admission year.
  // Legacy 2-part key when no cohort is set (existing users/posts).
  return cohort !== null
    ? JSON.stringify([normalizedCampus, normalizedProgram, cohort])
    : JSON.stringify([normalizedCampus, normalizedProgram])
}

export function programPostWhere(viewer: ProgramIdentity, legacyPrograms: readonly string[] = []): Prisma.PostWhereInput {
  const legacyKey = getProgramKey(viewer.campus, viewer.program)
  if (!legacyKey) return { id: { in: [] } }

  const programs = [...new Set(legacyPrograms.filter((program) => getProgramKey(viewer.campus, program) === legacyKey))]
  // Cohort viewer: own scoped key + legacy key (pre-cohort posts stay
  // visible). Other cohorts' scoped keys never match.
  // Viewer without a year: whole program family (legacy key is a prefix of
  // every scoped key), so nothing disappears until they pick a year.
  const cohort = validCohortYear(viewer.cohortYear)
  const keyClause =
    cohort !== null
      ? { programKey: { in: [getProgramKey(viewer.campus, viewer.program, cohort) as string, legacyKey] } }
      : { programKey: { startsWith: legacyKey.slice(0, -1) } }
  return {
    campus: viewer.campus,
    OR: [
      keyClause,
      {
        AND: [
          { OR: [{ programKey: null }, { programKey: "" }] },
          { program: { in: programs } },
        ],
      },
    ],
  }
}

export function readablePostWhere(viewer: ProgramIdentity, legacyPrograms: readonly string[] = []): Prisma.PostWhereInput {
  return {
    archived: false,
    OR: [
      { visibility: "school" },
      { AND: [{ visibility: "program" }, programPostWhere(viewer, legacyPrograms)] },
    ],
  }
}

export function canReadPost(viewer: ProgramIdentity, post: ProgramIdentity & { programKey?: string | null; visibility: string; archived: boolean }): boolean {
  if (post.archived) return false
  if (post.visibility === "school") return true
  if (post.visibility !== "program" || viewer.campus !== post.campus) return false
  const viewerLegacy = getProgramKey(viewer.campus, viewer.program)
  if (!viewerLegacy) return false
  // Pre-key posts fall back to the program snapshot, as before.
  const postKey = post.programKey || getProgramKey(post.campus, post.program)
  if (!postKey) return false
  const cohort = validCohortYear(viewer.cohortYear)
  if (cohort !== null) {
    // Cohort viewer: own class + pre-cohort posts. Never other cohorts.
    return postKey === getProgramKey(viewer.campus, viewer.program, cohort) || postKey === viewerLegacy
  }
  // No year picked yet: whole program family (legacy key prefixes scoped keys).
  return postKey === viewerLegacy || postKey.startsWith(`${viewerLegacy.slice(0, -1)},`)
}
