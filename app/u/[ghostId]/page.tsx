import { Metadata } from "next"
import { prisma } from "@/lib/prisma"
import ProfileClient from "./ProfileClient"

interface Props {
  params: Promise<{ ghostId: string }>
}

export const dynamic = "force-dynamic"

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  try {
  const { ghostId } = await params
  const user = await prisma.user.findUnique({
    where: { ghostId },
    select: {
      id: true,
      ghostId: true,
      avatarEmoji: true,
      campus: true,
      tier: true,
      streakCount: true,
      _count: { select: { posts: true, followers: true, following: true } },
    },
  })

  if (!user) {
    return {
      title: "Ghost Not Found | Yard",
    }
  }

  const profileUrl = `https://yardapp.me/u/${encodeURIComponent(user.ghostId)}`
  const description = `${user.ghostId} · ${user.campus} · 🔥 ${user.streakCount} streak · ${user._count.posts} posts`

  return {
    title: `${user.ghostId} | Yard`,
    description,
    openGraph: {
      type: "profile",
      url: profileUrl,
      title: `${user.ghostId} | Yard`,
      description,
      images: [
        {
          url: "/og-image.svg",
          width: 1200,
          height: 630,
          alt: `${user.ghostId} on Yard`,
        },
      ],
    },
    twitter: {
      card: "summary",
      title: `${user.ghostId} | Yard`,
      description,
      images: ["/og-image.svg"],
    },
  }
  } catch {
    return { title: "Yard — Ghost" }
  }
}

export default async function ProfilePage({ params }: Props) {
  const { ghostId } = await params
  return <ProfileClient ghostId={ghostId} />
}