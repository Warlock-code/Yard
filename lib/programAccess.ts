import { prisma } from "@/lib/prisma"
import { getProgramKey, programPostWhere, readablePostWhere } from "@/lib/program"
import type { ProgramIdentity } from "@/lib/program"

async function legacyProgramsFor(viewer: ProgramIdentity): Promise<string[]> {
  const key = getProgramKey(viewer.campus, viewer.program)
  if (!key) return []
  const posts = await prisma.post.findMany({
    where: {
      campus: viewer.campus,
      archived: false,
      OR: [{ programKey: null }, { programKey: "" }],
      program: { not: null },
    },
    select: { program: true },
    distinct: ["program"],
  })
  return posts.flatMap(({ program }) => program && getProgramKey(viewer.campus, program) === key ? [program] : [])
}

export async function getProgramPostWhere(viewer: ProgramIdentity) {
  return programPostWhere(viewer, await legacyProgramsFor(viewer))
}

export async function getReadablePostWhere(viewer: ProgramIdentity) {
  return readablePostWhere(viewer, await legacyProgramsFor(viewer))
}
