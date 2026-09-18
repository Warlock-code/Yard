import { Metadata } from "next"
import { prisma } from "@/lib/prisma"
import BattlesClient from "./BattlesClient"

export async function generateMetadata(): Promise<Metadata> {
  const prompt = await prisma.battlePrompt.findFirst({
    where: { active: true },
    orderBy: { startsAt: "desc" },
    select: { id: true, text: true, endsAt: true },
  })

  if (!prompt) {
    return {
      title: "Battles | Yard",
      description: "No active battle right now. Check back soon!",
    }
  }

  const battleUrl = `https://yardapp.me/battles`
  const truncatedText = prompt.text.length > 100 ? prompt.text.slice(0, 100) + "..." : prompt.text

  return {
    title: "Today's Battle | Yard",
    description: `Battle: ${truncatedText}`,
    openGraph: {
      type: "article",
      url: battleUrl,
      title: "Today's Battle | Yard",
      description: `Battle: ${truncatedText}`,
      images: [
        {
          url: "/og-image.svg",
          width: 1200,
          height: 630,
          alt: "Yard Battle",
        },
      ],
      publishedTime: new Date().toISOString(),
    },
    twitter: {
      card: "summary_large_image",
      title: "Today's Battle | Yard",
      description: `Battle: ${truncatedText}`,
      images: ["/og-image.svg"],
    },
  }
}

export default function BattlesPage() {
  return <BattlesClient />
}