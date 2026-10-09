import type { Metadata } from "next"
import { notFound } from "next/navigation"
import { prisma } from "@/lib/prisma"
import AskForm from "./AskForm"

export const dynamic = "force-dynamic"

export async function generateMetadata({ params }: { params: Promise<{ code: string }> }): Promise<Metadata> {
  const { code } = await params
  const clean = (code || "").trim().toUpperCase()
  let ghostId = "a ghost"
  try {
    const person = await prisma.user.findUnique({
      where: { inviteCode: clean },
      select: { ghostId: true },
    })
    if (person) ghostId = person.ghostId
  } catch {}

  const title = `ask ${ghostId} anything — anonymously`
  const description = "send an anonymous question on yard. they will never know it was you."
  // Absolute URLs: WhatsApp / IG crawlers ignore relative og:image.
  const pageUrl = `https://yardapp.me/ask/${clean}`
  const imageUrl = `https://yardapp.me/ask/${clean}/opengraph-image`
  return {
    title,
    description,
    openGraph: {
      type: "website",
      url: pageUrl,
      siteName: "yard",
      title,
      description,
      images: [{ url: imageUrl, width: 1200, height: 630, alt: title }],
    },
    twitter: {
      card: "summary_large_image",
      title,
      description,
      images: [imageUrl],
    },
  }
}

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
