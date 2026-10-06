import { NextRequest, NextResponse } from "next/server"
import { prisma } from "@/lib/prisma"
import { getCurrentUser } from "@/lib/getCurrentUser"
import { initializePaystack } from "@/lib/paystack"
import { creditUser } from "@/lib/credits"
import { THEME_MAP, isThemeId, themeCosmeticId } from "@/lib/themes"

export async function POST(req: NextRequest) {
  const user = await getCurrentUser(req)
  if (!user) return NextResponse.json({ error: "not authenticated." }, { status: 401 })

  const body = await req.json().catch(() => ({}))
  const themeId = typeof body.themeId === "string" ? body.themeId : ""
  if (!isThemeId(themeId)) return NextResponse.json({ error: "invalid theme." }, { status: 400 })

  const theme = THEME_MAP[themeId]
  if (theme.pricePesewas <= 0) {
    return NextResponse.json({ error: "this theme isn't purchasable." }, { status: 400 })
  }

  const cosmeticId = themeCosmeticId(theme.id)
  if (user.ownedCosmetics.includes(cosmeticId)) {
    return NextResponse.json({ error: "already owned." }, { status: 400 })
  }

  const useCredits = body.useCredits === true
  const creditCost = Math.round(theme.pricePesewas / 100)

  if (useCredits) {
    const reference = `theme_${theme.id}_${user.id}_${Date.now()}`
    try {
      const result = await creditUser(user.id, "THEME_BUY", -creditCost, reference, { cosmeticId, themeId: theme.id })
      try {
        await prisma.user.update({
          where: { id: user.id },
          data: { ownedCosmetics: { push: cosmeticId } },
        })
      } catch {
        // Grant failed after deduct — refund so the user never pays for nothing.
        await creditUser(user.id, "THEME_BUY", creditCost, `${reference}_refund`, { cosmeticId, themeId: theme.id, refund: true }).catch(() => {})
        return NextResponse.json({ error: "purchase failed, credits refunded. try again." }, { status: 500 })
      }
      return NextResponse.json({ success: true, creditsUsed: creditCost, newBalance: result.newBalance, message: "theme purchased with credits" })
    } catch (err) {
      return NextResponse.json({ error: err instanceof Error ? err.message : "Insufficient credits" }, { status: 400 })
    }
  }

  const reference = `theme_${theme.id}_${user.id}_${Date.now()}`

  await prisma.transaction.create({
    data: {
      userId: user.id,
      kind: "cosmetic",
      reference,
      amount: theme.pricePesewas,
      metadata: { cosmeticId, themeId: theme.id },
    },
  })

  try {
    const payment = await initializePaystack(user.email, theme.pricePesewas, reference)
    return NextResponse.json(payment)
  } catch (err) {
    await prisma.transaction.updateMany({ where: { reference, status: "pending" }, data: { status: "failed" } }).catch(() => {})
    console.error("[shop/theme] init failed", err)
    return NextResponse.json({ error: err instanceof Error ? err.message : "Checkout failed" }, { status: 400 })
  }
}
