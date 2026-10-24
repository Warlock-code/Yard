import { NextRequest, NextResponse } from "next/server"
import { prisma } from "@/lib/prisma"
import { getCurrentUser } from "@/lib/getCurrentUser"
import { creditUser, toCreditErrorResponse, CREDIT_CONFIG } from "@/lib/credits"
import { IDENTITY_UNLOCK_LEVEL } from "@/lib/levels"
import { userLevelInfo } from "@/lib/userLevel"

// Ghost name changes are credits-only (500 credits). Real money is only
// for buying credits + subscription — no Paystack checkout here.
const CUSTOM_NAME_CREDIT_COST = CREDIT_CONFIG.SPEND.CUSTOM_NAME

export async function POST(req: NextRequest) {
  const user = await getCurrentUser(req)
  if (!user) return NextResponse.json({ error: "not authenticated." }, { status: 401 })

  const body = await req.json().catch(() => ({}))
  const rawName = typeof body.newName === "string" ? body.newName.trim().toLowerCase() : ""

  // Identity items are part of the Status Ladder — names unlock at level 5.
  const levelInfo = await userLevelInfo(user.id)
  if (levelInfo.progress.currentLevel < IDENTITY_UNLOCK_LEVEL) {
    return NextResponse.json(
      { error: `custom names unlock at level ${IDENTITY_UNLOCK_LEVEL}.`, requiredLevel: IDENTITY_UNLOCK_LEVEL, myLevel: levelInfo.progress.currentLevel },
      { status: 403 }
    )
  }

  // Explicit opt-in so stale cached clients (old paystack flow) can never
  // trigger a surprise credits charge — they get a clear error instead.
  if (body.useCredits !== true) {
    return NextResponse.json({ error: "ghost name changes are credits-only now (500 credits). update the app and try again." }, { status: 400 })
  }

  if (!rawName) return NextResponse.json({ error: "enter a name." }, { status: 400 })
  if (rawName.length < 3 || rawName.length > 24) {
    return NextResponse.json({ error: "name must be 3–24 characters." }, { status: 400 })
  }
  if (rawName === user.ghostId.toLowerCase()) {
    return NextResponse.json({ error: "that's already your name." }, { status: 400 })
  }

  const taken = await prisma.user.findUnique({ where: { ghostId: rawName } })
  if (taken) return NextResponse.json({ error: "that ghost name is taken." }, { status: 400 })

  const reference = `custom_name_${user.id}_${Date.now()}`
  try {
    const result = await creditUser(user.id, "CUSTOM_NAME", -CUSTOM_NAME_CREDIT_COST, reference, { oldName: user.ghostId.toLowerCase(), newName: rawName })
    try {
      await prisma.user.update({ where: { id: user.id }, data: { ghostId: rawName } })
    } catch {
      // Rename failed after deduct — refund so the user never pays for nothing.
      await creditUser(user.id, "CUSTOM_NAME", CUSTOM_NAME_CREDIT_COST, `${reference}_refund`, { newName: rawName, refund: true }).catch(() => {})
      return NextResponse.json({ error: "rename failed, credits refunded. try again." }, { status: 500 })
    }
    return NextResponse.json({ success: true, creditsUsed: CUSTOM_NAME_CREDIT_COST, newBalance: result.newBalance, ghostId: rawName, message: "ghost name changed!" })
  } catch (err) {
    return toCreditErrorResponse(err, "rename failed.")
  }
}
