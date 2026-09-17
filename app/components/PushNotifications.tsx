"use client"

import { useEffect } from "react"
import { usePathname } from "next/navigation"
import { Capacitor } from "@capacitor/core"
import { LocalNotifications } from "@capacitor/local-notifications"
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
    let foregroundListener: { remove: () => Promise<void> } | undefined
    let localActionListener: { remove: () => Promise<void> } | undefined

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
        sound: "default",
      })

      const localPermission = await LocalNotifications.checkPermissions()
      if (localPermission.display === "prompt") {
        await LocalNotifications.requestPermissions()
      }

      await LocalNotifications.createChannel({
        id: "yard",
        name: "Yard notifications",
        description: "Comments and activity on your Yard posts",
        importance: 5,
        visibility: 1,
        sound: "default",
      })

      registrationListener = await PushNotifications.addListener("registration", async ({ value }) => {
        try {
          await apiPost("/api/notifications/register", { token: value })
        } catch {
          // The user may be signed out when the native app starts.
        }
      })
      registrationErrorListener = await PushNotifications.addListener("registrationError", () => {})
      foregroundListener = await PushNotifications.addListener("pushNotificationReceived", async (notification) => {
        if (!notification.title && !notification.body) return
        await LocalNotifications.schedule({
          notifications: [{
            id: Date.now() % 2147483647,
            title: notification.title || "Yard",
            body: notification.body || "You have a new notification.",
            channelId: "yard",
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
      await PushNotifications.register()
    }

    setup().catch(() => {})

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
