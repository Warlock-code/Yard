"use client"

import { useEffect } from "react"
import { usePathname } from "next/navigation"
import { Capacitor } from "@capacitor/core"
import { LocalNotifications } from "@capacitor/local-notifications"
import { PushNotifications } from "@capacitor/push-notifications"
import { apiGet, apiPost } from "@/lib/useApi"

export default function PushNotificationsSetup() {
  const pathname = usePathname()

  useEffect(() => {
    if (!Capacitor.isNativePlatform()) return

    let active = true
    let registrationListener: { remove: () => Promise<void> } | undefined
    let registrationErrorListener: { remove: () => Promise<void> } | undefined
    let actionListener: { remove: () => Promise<void> } | undefined
    let foregroundListener: { remove: () => Promise<void> } | undefined
    let localActionListener: { remove: () => Promise<void> } | undefined

    async function setup() {
      const permission = await PushNotifications.checkPermissions()
      if (!active || permission.receive === "denied") return

      const requested = permission.receive === "prompt"
        ? await PushNotifications.requestPermissions()
        : permission
      if (!active || requested.receive !== "granted") return

      await apiGet("/api/auth/me")

      await PushNotifications.createChannel({
        id: "yard-v2",
        name: "Yard notifications",
        description: "Comments and activity on your Yard posts",
        importance: 5,
        visibility: 1,
        sound: "default",
      }).catch((error) => console.error("Yard push channel setup failed", error))

      registrationListener = await PushNotifications.addListener("registration", async ({ value }) => {
        try {
          await apiPost("/api/notifications/register", { token: value })
        } catch (error) {
          console.error("Yard push token registration failed", error)
        }
      })
      registrationErrorListener = await PushNotifications.addListener("registrationError", (error) => {
        console.error("Yard push registration failed", error)
      })
      foregroundListener = await PushNotifications.addListener("pushNotificationReceived", async (notification) => {
        if (!notification.title && !notification.body) return
        await LocalNotifications.schedule({
          notifications: [{
            id: Date.now() % 2147483647,
            title: notification.title || "Yard",
            body: notification.body || "You have a new notification.",
            channelId: "yard-v2",
            extra: notification.data,
          }],
        })
      })
      actionListener = await PushNotifications.addListener("pushNotificationActionPerformed", ({ notification }) => {
        const href = notification.data?.href
        if (typeof href === "string" && href.startsWith("/")) window.location.href = href
      })
      localActionListener = await LocalNotifications.addListener("localNotificationActionPerformed", ({ notification }) => {
        const href = notification.extra?.href
        if (typeof href === "string" && href.startsWith("/")) window.location.href = href
      })

      try {
        const localPermission = await LocalNotifications.checkPermissions()
        if (localPermission.display === "prompt") {
          await LocalNotifications.requestPermissions()
        }
        await LocalNotifications.createChannel({
          id: "yard-v2",
          name: "Yard notifications",
          description: "Comments and activity on your Yard posts",
          importance: 5,
          visibility: 1,
          sound: "default",
        })
      } catch (error) {
        console.error("Yard local notification setup failed", error)
      }

      await PushNotifications.register()
    }

    setup().catch((error) => console.error("Yard push setup failed", error))

    return () => {
      active = false
      registrationListener?.remove()
      registrationErrorListener?.remove()
      foregroundListener?.remove()
      actionListener?.remove()
      localActionListener?.remove()
    }
  }, [pathname])

  return null
}
