"use client"

import { useEffect } from "react"
import { Capacitor } from "@capacitor/core"
import { PushNotifications } from "@capacitor/push-notifications"
import { apiPost } from "@/lib/useApi"

export default function PushNotificationsSetup() {
  useEffect(() => {
    if (!Capacitor.isNativePlatform()) return

    let active = true
    let registrationListener: { remove: () => Promise<void> } | undefined
    let registrationErrorListener: { remove: () => Promise<void> } | undefined

    async function setup() {
      const permission = await PushNotifications.checkPermissions()
      if (!active || permission.receive === "denied") return

      const requested = permission.receive === "prompt"
        ? await PushNotifications.requestPermissions()
        : permission
      if (!active || requested.receive !== "granted") return

      registrationListener = await PushNotifications.addListener("registration", async ({ value }) => {
        try {
          await apiPost("/api/notifications/register", { token: value })
        } catch {
          // The user may be signed out when the native app starts.
        }
      })
      registrationErrorListener = await PushNotifications.addListener("registrationError", () => {})
      await PushNotifications.register()
    }

    setup().catch(() => {})

    return () => {
      active = false
      registrationListener?.remove()
      registrationErrorListener?.remove()
    }
  }, [])

  return null
}
