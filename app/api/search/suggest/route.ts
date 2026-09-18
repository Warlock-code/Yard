import { NextRequest, NextResponse } from "next/server"
import { getCurrentUser } from "@/lib/getCurrentUser"
import { getRankedSuggestions, sanitizeSearchQuery, clampInt } from "@/lib/search"

export const dynamic = "force-dynamic"
export const runtime = "nodejs"

const MAX_LIMIT = 7

export async function GET(req: NextRequest) {
  const user = await getCurrentUser(req)
  if (!user) return NextResponse.json({ error: "Not authenticated." }, { status: 401 })

  const { searchParams } = new URL(req.url)
  const raw = searchParams.get("q") ?? ""
  const q = sanitizeSearchQuery(raw, 50)
  const campus = sanitizeSearchQuery(searchParams.get("campus"), 64) || user.campus
  const limit = clampInt(searchParams.get("limit"), MAX_LIMIT, 1, MAX_LIMIT)

  // Empty-q guard: fast empty response, no DB hit
  if (!q) {
    return NextResponse.json({ suggestions: [] })
  }

  try {
    const suggestions = await getRankedSuggestions(q, campus, user.id, limit)
    return NextResponse.json(
      { suggestions },
      { headers: { "Cache-Control": "private, max-age=30" } }
    )
  } catch (err) {
    console.error("GET /api/search/suggest failed", err)
    return NextResponse.json({ suggestions: [] })
  }
}
