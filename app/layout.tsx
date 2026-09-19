import type { Metadata } from "next"
import "./globals.css"
import BottomNav from "@/app/components/BottomNav"
import PushNotificationsSetup from "@/app/components/PushNotifications"
import { RoutePrefetcher } from "@/app/components/RoutePrefetcher"

export const metadata: Metadata = {
  metadataBase: new URL("https://yardapp.me"),
  title: "Yard — Your Campus Whisper Network",
  description: "Anonymous campus social network for students. Post confessions, gossip, memes, and more. Verified by school email.",
  keywords: ["campus", "anonymous", "social", "students", "confessions", "Ghana"],
  authors: [{ name: "Yard Team" }],
  creator: "Yard",
  publisher: "Yard",
  robots: {
    index: true,
    follow: true,
    googleBot: {
      index: true,
      follow: true,
      "max-video-preview": -1,
      "max-image-preview": "large",
      "max-snippet": -1,
    },
  },
  openGraph: {
    type: "website",
    locale: "en_GH",
    url: "https://yardapp.me",
    siteName: "Yard",
    title: "Yard — Your Campus Whisper Network",
    description: "Anonymous campus social network for students. Post confessions, gossip, memes, and more.",
    images: [
      {
        url: "/og-image.svg",
        width: 1200,
        height: 630,
        alt: "Yard App",
      },
    ],
  },
  twitter: {
    card: "summary_large_image",
    title: "Yard — Your Campus Whisper Network",
    description: "Anonymous campus social network for students.",
    images: ["/og-image.svg"],
  },
  icons: {
    icon: "/favicon.ico",
    shortcut: "/favicon.ico",
    apple: "/apple-touch-icon.png",
  },
  manifest: "/manifest.json",
}

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      <body>
        <PushNotificationsSetup />
        <RoutePrefetcher />
        {children}
        <BottomNav />
      </body>
    </html>
  )
}