import type { Prisma } from "@prisma/client"

export type ProgramIdentity = {
  campus: string
  program?: string | null
}

export function normalizeProgram(value: unknown): string | null {
  if (typeof value !== "string") return null
  return value.normalize("NFKC").trim().replace(/\s+/gu, " ").toLowerCase() || null
}

export function getProgramKey(campus: unknown, program: unknown): string | null {
  const normalizedCampus = normalizeProgram(campus)
  const normalizedProgram = normalizeProgram(program)
  return normalizedCampus && normalizedProgram
    ? JSON.stringify([normalizedCampus, normalizedProgram])
    : null
}

export function programPostWhere(viewer: ProgramIdentity, legacyPrograms: readonly string[] = []): Prisma.PostWhereInput {
  const programKey = getProgramKey(viewer.campus, viewer.program)
  if (!programKey) return { id: { in: [] } }

  const programs = [...new Set(legacyPrograms.filter((program) => getProgramKey(viewer.campus, program) === programKey))]
  return {
    campus: viewer.campus,
    OR: [
      { programKey },
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
  const key = getProgramKey(viewer.campus, viewer.program)
  return post.visibility === "program" && key !== null && viewer.campus === post.campus
    && key === (post.programKey || getProgramKey(post.campus, post.program))
}
