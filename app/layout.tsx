import type { Metadata } from "next"
import "./globals.css"
import BottomNav from "@/app/components/BottomNav"
import PushNotificationsSetup from "@/app/components/PushNotifications"

export const metadata: Metadata = {
  title: "Yard",
  description: "Your campus whisper network",
}

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      <body>
        <PushNotificationsSetup />
        {children}
        <BottomNav />
      </body>
    </html>
  )
}