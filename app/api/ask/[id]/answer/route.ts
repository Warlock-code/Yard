import { NextRequest, NextResponse } from "next/server"
import { prisma } from "@/lib/prisma"
import { getCurrentUser } from "@/lib/getCurrentUser"

export const dynamic = "force-dynamic"

// Answer a question publicly: posts it to the campus feed as a Q&A card.
export async function POST(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const user = await getCurrentUser(req)
  if (!user) return NextResponse.json({ error: "not authenticated." }, { status: 401 })

  const { id } = await params
  const body = await req.json().catch(() => ({}))
  const answer = typeof body.answer === "string" ? body.answer.trim().toLowerCase() : ""
  if (!answer) return NextResponse.json({ error: "write your answer first." }, { status: 400 })
  if (answer.length > 2000) return NextResponse.json({ error: "answer must be 2000 characters or fewer." }, { status: 400 })

  let q: { id: string; recipientId: string; text: string; status: string } | null = null
  try {
    q = await prisma.askQuestion.findUnique({ where: { id } })
  } catch {
    return NextResponse.json({ error: "ask is updating — try again in a bit." }, { status: 503 })
  }
  if (!q || q.recipientId !== user.id) return NextResponse.json({ error: "question not found." }, { status: 404 })
  if (q.status !== "pending") return NextResponse.json({ error: "already handled." }, { status: 400 })

  const post = await prisma.post.create({
    data: {
      userId: user.id,
      text: `anonymous asked: ${q.text}\n\n${answer}`,
      type: "ask",
      campus: user.campus,
      program: user.program,
      programLevel: user.programLevel,
      cohortYear: user.cohortYear,
      programKey: user.programKey,
      isPrime: false,
      visibility: "school",
    },
  })

  try {
    await prisma.askQuestion.update({
      where: { id: q.id },
      data: { status: "answered", answer, answerPostId: post.id },
    })
  } catch {}

  return NextResponse.json({ success: true, postId: post.id })
}
