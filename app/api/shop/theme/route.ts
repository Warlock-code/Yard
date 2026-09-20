import { NextRequest, NextResponse } from "next/server"
import { prisma } from "@/lib/prisma"
import { getCurrentUser } from "@/lib/getCurrentUser"
import { initializePaystack } from "@/lib/paystack"
import { THEME_MAP, isThemeId, themeCosmeticId } from "@/lib/themes"

export async function POST(req: NextRequest) {
  const user = await getCurrentUser(req)
  if (!user) return NextResponse.json({ error: "Not authenticated." }, { status: 401 })

  const { themeId } = await req.json()
  if (!isThemeId(themeId)) return NextResponse.json({ error: "Invalid theme." }, { status: 400 })

  const theme = THEME_MAP[themeId]
  if (theme.pricePesewas <= 0) {
    return NextResponse.json({ error: "This theme isn't purchasable." }, { status: 400 })
  }

  const cosmeticId = themeCosmeticId(theme.id)
  if (user.ownedCosmetics.includes(cosmeticId)) {
    return NextResponse.json({ error: "Already owned." }, { status: 400 })
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
