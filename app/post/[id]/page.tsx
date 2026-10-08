import { Metadata } from "next"
import { prisma } from "@/lib/prisma"
import PostDetailClient from "./PostDetailClient"

interface Props {
  params: Promise<{ id: string }>
}

export const dynamic = "force-dynamic"

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  try {
  const { id } = await params
  const post = await prisma.post.findUnique({
    where: { id },
    select: {
      id: true,
      text: true,
      imageUrl: true,
      createdAt: true,
      user: { select: { ghostId: true, avatarEmoji: true } },
    },
  })

  if (!post) {
    return {
      title: "Post Not Found | Yard",
    }
  }

  const postText = post.text || "A post on Yard"
  const truncatedText = postText.length > 100 ? postText.slice(0, 100) + "..." : postText
  // Stylish dynamic card (answers render as Q&A). Falls back to the
  // uploader image when the post itself has one.
  const imageUrl = post.imageUrl || `/post/${post.id}/opengraph-image`
  const postUrl = `https://yardapp.me/post/${post.id}`

  return {
    title: `${post.user.ghostId} on Yard`,
    description: truncatedText,
    openGraph: {
      type: "article",
      url: postUrl,
      title: `${post.user.ghostId} on Yard`,
      description: truncatedText,
      images: [
        {
          url: imageUrl,
          width: 1200,
          height: 630,
          alt: `Post by ${post.user.ghostId}`,
        },
      ],
      publishedTime: post.createdAt.toISOString(),
      authors: [post.user.ghostId],
    },
    twitter: {
      card: "summary_large_image",
      title: `${post.user.ghostId} on Yard`,
      description: truncatedText,
      images: [imageUrl],
    },
  }
  } catch {
    return { title: "Yard — Post" }
  }
}

export default async function PostPage({ params }: Props) {
  const { id } = await params
  return <PostDetailClient postId={id} />
}