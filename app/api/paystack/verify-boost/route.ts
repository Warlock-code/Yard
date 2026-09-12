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

  const postId = (tx.metadata as any)?.postId

  await prisma.$transaction([
    prisma.transaction.update({ where: { reference }, data: { status: "success" } }),
    prisma.post.update({
      where: { id: postId },
      data: { boosted: true, boostedUntil: new Date(Date.now() + 24 * 60 * 60 * 1000) },
    }),
  ])

  return NextResponse.json({ success: true })
}