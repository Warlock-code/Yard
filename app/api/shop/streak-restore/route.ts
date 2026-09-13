import { NextRequest, NextResponse } from "next/server"
import { prisma } from "@/lib/prisma"
import { getCurrentUser } from "@/lib/getCurrentUser"
import { initializePaystack } from "@/lib/paystack"

const RESTORE_PRICE_PESEWAS = 300

export async function POST(req: NextRequest) {
  const user = await getCurrentUser(req)
  if (!user) return NextResponse.json({ error: "Not authenticated." }, { status: 401 })

  const withinGrace =
    user.streakBrokenAt && new Date(user.streakBrokenAt).getTime() > Date.now() - 48 * 60 * 60 * 1000

  if (!user.lastStreakCount || !withinGrace) {
    return NextResponse.json({ error: "No recently broken streak to restore." }, { status: 400 })
  }

  const reference = `restore_${user.id}_${Date.now()}`

  await prisma.transaction.create({
    data: { userId: user.id, kind: "restore", reference, amount: RESTORE_PRICE_PESEWAS },
  })

  const payment = await initializePaystack(user.email, RESTORE_PRICE_PESEWAS, reference)
  return NextResponse.json(payment)
}