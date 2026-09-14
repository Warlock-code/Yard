import { NextRequest, NextResponse } from "next/server"
import { prisma } from "@/lib/prisma"
import { verifyPaystack } from "@/lib/paystack"

export async function POST(req: NextRequest) {
  const { reference } = await req.json()

  const result = await verifyPaystack(reference)
  if (result.data?.status !== "success") {
    return NextResponse.json({ error: "Payment not verified." }, { status: 400 })
  }

  const tx = await prisma.transaction.findUnique({ where: { reference } })
  if (!tx || tx.status === "success") {
    return NextResponse.json({ error: "Invalid or already-processed transaction." }, { status: 400 })
  }

  const meta = tx.metadata as any

  switch (tx.kind) {
    case "boost":
      await prisma.post.update({
        where: { id: meta.postId },
        data: { boosted: true, boostedUntil: new Date(Date.now() + 24 * 60 * 60 * 1000) },
      })
      break

    case "custom_name":
      await prisma.user.update({
        where: { id: tx.userId },
        data: { ghostId: meta.newName },
      })
      break

    case "freeze":
      await prisma.user.update({
        where: { id: tx.userId },
        data: { streakFreezeUntil: new Date(Date.now() + 48 * 60 * 60 * 1000) },
      })
      break

    case "storage":
      await prisma.user.update({
        where: { id: tx.userId },
        data: { storageLimit: { increment: meta.mb } },
      })
      break

    case "restore": {
      const brokenUser = await prisma.user.findUnique({ where: { id: tx.userId } })
      if (brokenUser?.lastStreakCount) {
        await prisma.user.update({
          where: { id: tx.userId },
          data: {
            streakCount: brokenUser.lastStreakCount,
            lastStreakCount: null,
            streakBrokenAt: null,
          },
        })
      }
      break
    }

    case "cosmetic":
      await prisma.user.update({
        where: { id: tx.userId },
        data: { ownedCosmetics: { push: meta.cosmeticId } },
      })
      break
  }

  await prisma.transaction.update({ where: { reference }, data: { status: "success" } })

  return NextResponse.json({ success: true })
}

    case "boost_credit":
      await prisma.user.update({ where: { id: tx.userId }, data: { freeBoosts: { increment: 1 } } })
      break