import { NextRequest, NextResponse } from "next/server"
import { getCurrentUser } from "@/lib/getCurrentUser"
import { getSavedSearches, saveSearch, deleteSavedSearch } from "@/lib/search"

export async function GET(req: NextRequest) {
  const user = await getCurrentUser(req)
  if (!user) return NextResponse.json({ error: "Not authenticated." }, { status: 401 })

  if (user.tier !== "PRIME") {
    return NextResponse.json({ error: "Prime feature. Upgrade to save searches." }, { status: 403 })
  }

  const searches = await getSavedSearches(user.id)
  return NextResponse.json({ searches })
}

export async function POST(req: NextRequest) {
  const user = await getCurrentUser(req)
  if (!user) return NextResponse.json({ error: "Not authenticated." }, { status: 401 })

  if (user.tier !== "PRIME") {
    return NextResponse.json({ error: "Prime feature. Upgrade to save searches." }, { status: 403 })
  }

  const { name, query, filters, alertEnabled } = await req.json()

  if (!name || !query) {
    return NextResponse.json({ error: "Name and query are required." }, { status: 400 })
  }

  try {
    const saved = await saveSearch(user.id, name, query, filters || {}, alertEnabled || false)
    return NextResponse.json({ search: saved })
  } catch (err: unknown) {
    if (err instanceof Error && err.message.includes("Unique constraint")) {
      return NextResponse.json({ error: "A saved search with this name already exists." }, { status: 400 })
    }
    throw err
  }
}

export async function DELETE(req: NextRequest) {
  const user = await getCurrentUser(req)
  if (!user) return NextResponse.json({ error: "Not authenticated." }, { status: 401 })

  const { searchParams } = new URL(req.url)
  const searchId = searchParams.get("id")

  if (!searchId) {
    return NextResponse.json({ error: "Search ID required." }, { status: 400 })
  }

  await deleteSavedSearch(user.id, searchId)
  return NextResponse.json({ success: true })
}