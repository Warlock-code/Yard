import { NextRequest, NextResponse } from "next/server"
import { prisma } from "@/lib/prisma"
import { isAdmin } from "@/lib/getAdmin"

export const dynamic = "force-dynamic"
export const revalidate = 0
export const fetchCache = "force-no-store"

export async function PATCH(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  if (!isAdmin(req)) return NextResponse.json({ error: "Not authorized." }, { status: 403 })
  const { id } = await params
  const { action } = await req.json()

  if (action !== "suspend" && action !== "ban" && action !== "unsuspend") {
    return NextResponse.json({ error: "Invalid action." }, { status: 400 })
  }

  const statusMap = { suspend: "SUSPENDED", ban: "BANNED", unsuspend: "ACTIVE" } as const
  const user = await prisma.user.update({
    where: { id },
    data: { status: statusMap[action as keyof typeof statusMap] },
    select: { id: true, status: true, email: true },
  })

  if (action !== "unsuspend") {
    await prisma.deviceToken.deleteMany({ where: { userId: id } })
    await prisma.user.update({ where: { id }, data: { pushToken: null } })
  }

  return NextResponse.json({ user })
}

export async function DELETE(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  if (!isAdmin(req)) return NextResponse.json({ error: "Not authorized." }, { status: 403 })
  const { id } = await params
  await prisma.user.delete({ where: { id } })
  return NextResponse.json({ success: true })
}