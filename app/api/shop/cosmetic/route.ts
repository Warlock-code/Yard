import { NextRequest, NextResponse } from "next/server"
import { prisma } from "@/lib/prisma"
import { getCurrentUser } from "@/lib/getCurrentUser"
import { initializePaystack } from "@/lib/paystack"

export const COSMETICS = [
  { id: "avatar_fox", name: "Fox Avatar", emoji: "🦊", pricePesewas: 200 },
  { id: "avatar_cat", name: "Cat Avatar", emoji: "🐱", pricePesewas: 200 },
  { id: "avatar_alien", name: "Alien Avatar", emoji: "👽", pricePesewas: 250 },
  { id: "avatar_robot", name: "Robot Avatar", emoji: "🤖", pricePesewas: 250 },
]

export async function POST(req: NextRequest) {
  const user = await getCurrentUser(req)
  if (!user) return NextResponse.json({ error: "Not authenticated." }, { status: 401 })

  const { cosmeticId } = await req.json()
  const item = COSMETICS.find((c) => c.id === cosmeticId)
  if (!item) return NextResponse.json({ error: "Invalid item." }, { status: 400 })

  if (user.ownedCosmetics.includes(cosmeticId)) {
    return NextResponse.json({ error: "Already owned." }, { status: 400 })
  }

  const reference = `cosmetic_${cosmeticId}_${user.id}_${Date.now()}`

  await prisma.transaction.create({
    data: {
      userId: user.id,
      kind: "cosmetic",
      reference,
      amount: item.pricePesewas,
      metadata: { cosmeticId, emoji: item.emoji },
    },
  })

  const payment = await initializePaystack(user.email, item.pricePesewas, reference)
  return NextResponse.json(payment)
}