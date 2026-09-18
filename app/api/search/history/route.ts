import { NextRequest, NextResponse } from "next/server"
import { getCurrentUser } from "@/lib/getCurrentUser"
import { getRecentSearches } from "@/lib/search"

export async function GET(req: NextRequest) {
  const user = await getCurrentUser(req)
  if (!user) return NextResponse.json({ error: "Not authenticated." }, { status: 401 })

  const { searchParams } = new URL(req.url)
  const limit = parseInt(searchParams.get("limit") || "10")

  const searches = await getRecentSearches(user.id, limit)

  return NextResponse.json({ searches })
}

export async function DELETE(req: NextRequest) {
  const user = await getCurrentUser(req)
  if (!user) return NextResponse.json({ error: "Not authenticated." }, { status: 401 })

  const { searchParams } = new URL(req.url)
  const searchId = searchParams.get("id")

  if (searchId) {
    const { prisma } = await import("@/lib/prisma")
    await prisma.searchHistory.deleteMany({ where: { id: searchId, userId: user.id } })
    return NextResponse.json({ success: true })
  }

  const { prisma } = await import("@/lib/prisma")
  await prisma.searchHistory.deleteMany({ where: { userId: user.id } })
  return NextResponse.json({ success: true })
}