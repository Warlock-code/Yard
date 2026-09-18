"use client"

import Link from "next/link"
import { useEffect, useState, useCallback } from "react"
import { apiGet, apiPatch, apiPost } from "@/lib/useApi"
import { timeAgo } from "@/lib/timeAgo"
import { useSocket } from "@/lib/socket"

type Notification = {
  id: string
  title: string
  body: string
  href: string
  readAt: string | null
  createdAt: string
  icon?: string
  type?: string
}

const VAPID_PUBLIC_KEY = process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY || ""

function urlBase64ToUint8Array(base64String: string) {
  const padding = "=".repeat((4 - (base64String.length % 4)) % 4)
  const base64 = (base64String + padding).replace(/-/g, "+").replace(/_/g, "/")
  const rawData = window.atob(base64)
  const outputArray = new Uint8Array(rawData.length)
  for (let i = 0; i < rawData.length; ++i) {
    outputArray[i] = rawData.charCodeAt(i)
  }
  return outputArray
}

async function registerPushToken() {
  if (!("serviceWorker" in navigator) || !("PushManager" in window) || !VAPID_PUBLIC_KEY) return

  try {
    const registration = await navigator.serviceWorker.ready
    const subscription = await registration.pushManager.subscribe({
      userVisibleOnly: true,
      applicationServerKey: urlBase64ToUint8Array(VAPID_PUBLIC_KEY),
    })

    const token = JSON.stringify(subscription)
    await apiPost("/api/notifications/register", { token })
    console.log("Push token registered")
  } catch (error) {
    console.error("Push registration failed:", error)
  }
}

export default function NotificationsPage() {
  const [notifications, setNotifications] = useState<Notification[]>([])
  const [loading, setLoading] = useState(true)

  const { connected, on } = useSocket()

  const loadNotifications = useCallback(async () => {
    try {
      const data = await apiGet("/api/notifications")
      setNotifications(data.notifications)
    } catch {}
    finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => {
    const init = async () => {
      await loadNotifications()
      await registerPushToken()
    }
    init()
  }, [loadNotifications])

  useEffect(() => {
    if (!connected) return
    const unsub = on("notification", (notification: Notification) => {
      setNotifications((prev) => [notification, ...prev])
    })
    return () => unsub()
  }, [connected, on])

  async function openNotification(notification: Notification) {
    if (!notification.readAt) {
      await apiPatch("/api/notifications", { id: notification.id }).catch(() => {})
      setNotifications((current) => current.map((item) => (
        item.id === notification.id ? { ...item, readAt: new Date().toISOString() } : item
      )))
    }
  }

  async function markAllRead() {
    await apiPatch("/api/notifications", { all: true }).catch(() => {})
    setNotifications((current) => current.map((item) => ({ ...item, readAt: item.readAt || new Date().toISOString() })))
  }

  return (
    <main className="min-h-screen max-w-lg mx-auto pb-28 px-4">
      <div className="flex items-center justify-between pt-5 pb-4">
        <h1 className="text-2xl font-black">Notifications</h1>
        {notifications.some((notification) => !notification.readAt) && (
          <button className="text-xs text-[#baff39]" onClick={markAllRead}>Mark all read</button>
        )}
      </div>

      {loading ? (
        <p className="text-center text-white/40 mt-10">Loading notifications...</p>
      ) : notifications.length === 0 ? (
        <div className="text-center mt-16 px-8">
          <p className="text-3xl mb-3">🔔</p>
          <p className="text-white/50 text-sm">Your notifications will appear here.</p>
        </div>
      ) : (
        <div className="space-y-2">
          {notifications.map((notification) => (
            <Link
              key={notification.id}
              href={notification.href}
              onClick={() => openNotification(notification)}
              className={`block rounded-xl border p-4 ${notification.readAt ? "border-white/10 bg-white/[0.02]" : "border-[#baff39]/30 bg-[#baff39]/[0.06]"}`}
            >
              <div className="flex items-start gap-3">
                <span className="text-xl">{notification.icon || "🔔"}</span>
                <div className="min-w-0 flex-1">
                  <p className="font-semibold text-sm">{notification.title}</p>
                  <p className="text-sm text-white/60 mt-1">{notification.body}</p>
                  <p className="text-xs text-white/30 mt-2">{timeAgo(notification.createdAt)}</p>
                </div>
                {!notification.readAt && <span className="w-2 h-2 rounded-full bg-[#baff39] mt-2" />}
              </div>
            </Link>
          ))}
        </div>
      )}
    </main>
  )
}