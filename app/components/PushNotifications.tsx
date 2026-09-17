"use client"

import { useEffect } from "react"
import { usePathname } from "next/navigation"
import { Capacitor } from "@capacitor/core"
import { PushNotifications } from "@capacitor/push-notifications"
import { apiPost } from "@/lib/useApi"

export default function PushNotificationsSetup() {
  const pathname = usePathname()

  useEffect(() => {
    if (!Capacitor.isNativePlatform()) return

    let active = true
    let registrationListener: { remove: () => Promise<void> } | undefined
    let registrationErrorListener: { remove: () => Promise<void> } | undefined
    let actionListener: { remove: () => Promise<void> } | undefined

    async function setup() {
      const permission = await PushNotifications.checkPermissions()
      if (!active || permission.receive === "denied") return

      const requested = permission.receive === "prompt"
        ? await PushNotifications.requestPermissions()
        : permission
      if (!active || requested.receive !== "granted") return

      await PushNotifications.createChannel({
        id: "yard",
        name: "Yard notifications",
        description: "Comments and activity on your Yard posts",
        importance: 5,
        visibility: 1,
      })

      registrationListener = await PushNotifications.addListener("registration", async ({ value }) => {
        try {
          await apiPost("/api/notifications/register", { token: value })
        } catch {
          // The user may be signed out when the native app starts.
        }
      })
      registrationErrorListener = await PushNotifications.addListener("registrationError", () => {})
      actionListener = await PushNotifications.addListener("pushNotificationActionPerformed", ({ notification }) => {
        const href = notification.data?.href
        if (typeof href === "string" && href.startsWith("/")) window.location.href = href
      })
      await PushNotifications.register()
    }

    setup().catch(() => {})

    return () => {
      active = false
      registrationListener?.remove()
      registrationErrorListener?.remove()
      actionListener?.remove()
    }
  }, [pathname])

  return null
}
