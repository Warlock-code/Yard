"use client"

import { useEffect } from "react"
import { usePathname } from "next/navigation"
import { Capacitor } from "@capacitor/core"
import { registerPlugin } from "@capacitor/core"
import { apiGet, apiPost } from "@/lib/useApi"

const YardPush = registerPlugin<{ getToken: () => Promise<{ token: string }> }>("YardPush")

export default function PushNotificationsSetup() {
  const pathname = usePathname()

  useEffect(() => {
    if (!Capacitor.isNativePlatform()) return

    let active = true
    let registeredToken = ""
    let retryTimer: ReturnType<typeof setTimeout> | undefined
    let registrationInFlight = false

    async function getNativeToken() {
      const result = await YardPush.getToken()
      if (!result.token) throw new Error("Native Firebase returned an empty token")
      return result.token
    }

    function retryRegistration() {
      if (!active || retryTimer || registeredToken) return
      retryTimer = setTimeout(() => {
        retryTimer = undefined
        registerForPush().catch((error) => console.error("Yard push retry failed", error))
      }, 1000)
    }

    async function registerForPush() {
      if (!active || registrationInFlight || registeredToken) return
      registrationInFlight = true
      try {
        const token = await getNativeToken()
        registeredToken = token
        await apiPost("/api/notifications/register", { token })
        console.info("Yard native push token registered")
      } catch (error) {
        console.error("Yard push registration attempt failed", error)
        registeredToken = ""
        retryRegistration()
      } finally {
        registrationInFlight = false
      }
    }

    async function setup() {
      try {
        await apiGet("/api/auth/me")
      } catch {
        return
      }

      await registerForPush()

      if (registeredToken) {
        await apiPost("/api/notifications/register", { token: registeredToken }).catch((error) => {
          console.error("Yard push token retry failed", error)
          registeredToken = ""
          retryRegistration()
        })
      }
    }

    setup().catch((error) => console.error("Yard push setup failed", error))

    return () => {
      active = false
      if (retryTimer) clearTimeout(retryTimer)
    }
  }, [pathname])

  return null
}
