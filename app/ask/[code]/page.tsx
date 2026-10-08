import { notFound } from "next/navigation"
import { prisma } from "@/lib/prisma"
import AskForm from "./AskForm"

export const dynamic = "force-dynamic"

export default async function AskPage({ params }: { params: Promise<{ code: string }> }) {
  const { code } = await params
  const clean = (code || "").trim().toUpperCase()
  if (!clean) notFound()

  let person: { ghostId: string; avatarEmoji: string; campus: string; inviteCode: string } | null = null
  try {
    person = await prisma.user.findUnique({
      where: { inviteCode: clean },
      select: { ghostId: true, avatarEmoji: true, campus: true, inviteCode: true },
    })
  } catch {
    person = null
  }
  if (!person) notFound()

  return <AskForm code={person.inviteCode} ghostId={person.ghostId} avatarEmoji={person.avatarEmoji} campus={person.campus} />
}
