import { Metadata } from "next"
import { prisma } from "@/lib/prisma"
import BattlesClient from "./BattlesClient"

export const dynamic = "force-dynamic"

export async function generateMetadata(): Promise<Metadata> {
  try {
  const prompt = await prisma.battlePrompt.findFirst({
    where: { active: true },
    orderBy: { startsAt: "desc" },
    select: { id: true, text: true, endsAt: true },
  })

  if (!prompt) {
    return {
      title: "battles | yard",
      description: "no active battle right now. check back soon!",
    }
  }

  const battleUrl = `https://yardapp.me/battles`
  const truncatedText = prompt.text.length > 100 ? prompt.text.slice(0, 100) + "..." : prompt.text

  return {
    title: "today's battle | yard",
    description: `battle: ${truncatedText}`,
    openGraph: {
      type: "article",
      url: battleUrl,
      title: "today's battle | yard",
      description: `battle: ${truncatedText}`,
      images: [
        {
          url: "/og-image.svg",
          width: 1200,
          height: 630,
          alt: "yard battle",
        },
      ],
      publishedTime: new Date().toISOString(),
    },
    twitter: {
      card: "summary_large_image",
      title: "today's battle | yard",
      description: `battle: ${truncatedText}`,
      images: ["/og-image.svg"],
    },
  }
  } catch {
    return { title: "battles | yard", description: "campus battles on yard" }
  }
}

export default function BattlesPage() {
  return <BattlesClient />
}