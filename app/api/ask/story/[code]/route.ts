import { ImageResponse } from "next/og"
import { prisma } from "@/lib/prisma"
import { StoryCard } from "./card"

export const runtime = "nodejs"
export const dynamic = "force-dynamic"

// Portrait story card (1080x1920) for WhatsApp/IG status. Fetched by the
// app and shared via the native share sheet as an image, so no ugly raw
// link + generic preview. Pure text/shapes (no emoji — font-safe).
// Fail-open: always returns a generic card, never a 500.
export async function GET(_req: Request, { params }: { params: Promise<{ code: string }> }) {
  const { code } = await params
  const clean = (code || "").trim().toUpperCase()

  let ghostId = "a ghost"
  let campus = "your campus"
  try {
    const person = await prisma.user.findUnique({
      where: { inviteCode: clean },
      select: { ghostId: true, campus: true },
    })
    if (person) {
      ghostId = person.ghostId
      if (person.campus) campus = person.campus
    }
  } catch {}

  return new ImageResponse(StoryCard({ ghostId, campus }), {
    width: 1080,
    height: 1920,
  })
}
