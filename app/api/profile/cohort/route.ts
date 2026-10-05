import { NextRequest, NextResponse } from "next/server"
import { prisma } from "@/lib/prisma"
import { getCurrentUser } from "@/lib/getCurrentUser"
import { getProgramKey } from "@/lib/program"
import { cohortYearSchema, validateRequest } from "@/lib/validation"

export const dynamic = "force-dynamic"

// One-time (or corrective) admission-year pick for users who signed up
// before cohorts existed. Recomputes the program key so their class feed
// narrows to their own class immediately.
export async function PATCH(req: NextRequest) {
  const user = await getCurrentUser(req)
  if (!user) return NextResponse.json({ error: "not authenticated." }, { status: 401 })

  const body = await req.json().catch(() => ({}))
  const validation = validateRequest(cohortYearSchema, body)
  if (!validation.success) {
    return NextResponse.json({ error: validation.error }, { status: 400 })
  }

  const updated = await prisma.user.update({
    where: { id: user.id },
    data: {
      cohortYear: validation.data.cohortYear,
      programKey: getProgramKey(user.campus, user.program, validation.data.cohortYear),
    },
    select: { cohortYear: true, programKey: true },
  })

  return NextResponse.json({ success: true, ...updated })
}
