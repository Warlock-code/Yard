"use client"

import { useCallback, useEffect, useMemo, useState } from "react"
import { useRouter } from "next/navigation"
import { apiGet, apiPatch } from "@/lib/useApi"
import Avatar from "@/app/components/Avatar"
import {
  getPushSubscriptionStatus,
  isNativePushPlatform,
  subscribeForPush,
} from "@/app/components/PushNotifications"

type Me = {
  ghostId: string
  avatarEmoji: string
  campus: string
  cohortYear: number | null
  tier: string
}

export default function SettingsPage() {
  const router = useRouter()
  const [me, setMe] = useState<Me | null>(null)
  const [loading, setLoading] = useState(true)
  const [yearDraft, setYearDraft] = useState("")
  const [yearSaving, setYearSaving] = useState(false)
  const [yearMsg, setYearMsg] = useState("")
  const [showDeleteModal, setShowDeleteModal] = useState(false)
  const [deletePassword, setDeletePassword] = useState("")
  const [deleting, setDeleting] = useState(false)
  const [pushPermission, setPushPermission] = useState("default")
  const [pushSubscribed, setPushSubscribed] = useState(false)
  const [pushBusy, setPushBusy] = useState(false)
  const [pushMessage, setPushMessage] = useState("")

  const admissionYears = useMemo(() => {
    const current = new Date().getFullYear() + 1
    return Array.from({ length: 12 }, (_, i) => current - i)
  }, [])

  const load = useCallback(() => {
    apiGet<{ user: Me | null }>("/api/auth/me")
      .then((data) => {
        if (!data.user) {
          router.push("/login")
          return
        }
        setMe(data.user)
        setYearDraft(data.user.cohortYear != null ? String(data.user.cohortYear) : "")
      })
      .catch(() => {})
      .finally(() => setLoading(false))
  }, [router])

  useEffect(() => {
    load()
  }, [load])

  useEffect(() => {
    if (typeof window === "undefined") return
    let cancelled = false

    const native = isNativePushPlatform()
    if (native) {
      // Native permission lives in Android/iOS, not the WebView Notification
      // API. Keep the card actionable and let getPushSubscriptionStatus do the
      // Capacitor permission check.
      void Promise.resolve().then(() => {
        if (!cancelled) setPushPermission("granted")
      })
    } else {
      if (!("Notification" in window)) return
      const permission = Notification.permission
      void Promise.resolve().then(() => {
        if (!cancelled) setPushPermission(permission)
      })
      if (permission !== "granted") return
      if (!("serviceWorker" in navigator) || !("PushManager" in window)) return
    }

    getPushSubscriptionStatus()
      .then((status) => {
        if (cancelled) return
        if (native) setPushPermission("granted")
        else if ("Notification" in window) setPushPermission(Notification.permission)
        setPushSubscribed(status.subscribed && status.current)
        if (status.subscribed && !status.current) {
          setPushMessage("your saved push subscription uses an old key — tap enable to refresh it.")
        } else if (status.error) {
          setPushMessage(status.error)
        }
      })
      .catch((err: unknown) => {
        if (cancelled) return
        setPushSubscribed(false)
        setPushMessage(err instanceof Error ? `${err.name}: ${err.message}` : String(err))
      })

    return () => {
      cancelled = true
    }
  }, [])

  async function handleEnablePush() {
    if (pushBusy) return
    setPushBusy(true)
    setPushMessage("")
    try {
      const native = isNativePushPlatform()
      const result = await subscribeForPush({ requestPermission: true, resetExisting: true })
      const permission = native
        ? "granted"
        : typeof window !== "undefined" && "Notification" in window
          ? Notification.permission
          : "default"
      setPushPermission(permission)
      setPushSubscribed(result.ok)
      if (!result.ok) {
        // Surface the exact browser/FCM/registration error instead of hiding
        // it behind a generic connectivity message.
        setPushMessage(result.error || "push failed — unknown error.")
      }
    } finally {
      setPushBusy(false)
    }
  }

  async function handleYearSave() {
    if (!yearDraft || yearSaving) return
    setYearSaving(true)
    setYearMsg("")
    try {
      const data = await apiPatch<{ cohortYear: number }>("/api/profile/cohort", {
        cohortYear: Number(yearDraft),
      })
      setMe((cur) => (cur ? { ...cur, cohortYear: data.cohortYear } : cur))
      setYearMsg("saved — class feed updated.")
    } catch (err: unknown) {
      setYearMsg(err instanceof Error ? err.message : "couldn't save. try again.")
    } finally {
      setYearSaving(false)
    }
  }

  async function handleDeleteAccount() {
    if (!deletePassword.trim()) {
      alert("enter your password to confirm.")
      return
    }
    setDeleting(true)
    try {
      const res = await fetch("/api/auth/delete-account", {
        method: "DELETE",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify({ password: deletePassword }),
      })
      if (!res.ok) {
        const data = await res.json()
        throw new Error(data.error || "could not delete account.")
      }
      router.push("/signup")
    } catch (err: unknown) {
      alert(err instanceof Error ? err.message : "something went wrong.")
    } finally {
      setDeleting(false)
      setShowDeleteModal(false)
      setDeletePassword("")
    }
  }

  if (loading || !me) return <p className="text-center text-white/40 mt-10">opening settings...</p>

  return (
    <main className="min-h-screen max-w-lg mx-auto pb-28 px-4">
      <div className="flex items-center gap-3 mt-6 mb-5">
        <button onClick={() => router.back()} aria-label="back" className="btn-ghost px-3">
          ←
        </button>
        <div>
          <p className="text-xs text-white/30 uppercase tracking-widest">sidebar</p>
          <h1 className="text-xl font-bold">settings</h1>
        </div>
      </div>

      <div className="card p-4 mb-3 flex items-center gap-3">
        <Avatar emoji={me.avatarEmoji} size={48} />
        <div className="min-w-0">
          <p className="font-bold truncate">{me.ghostId}</p>
          <p className="text-xs text-white/40 truncate">
            {me.campus}
            {me.cohortYear != null ? ` • class of ${me.cohortYear}` : " • no class year yet"}
          </p>
        </div>
      </div>

      <div className="card p-4 mb-3 border-primary/20">
        <p className="font-semibold mb-1">🎓 admission year</p>
        <p className="text-sm text-white/50 mb-3">
          this puts you in the right class feed. moved here from the lair so it is easy to find.
        </p>
        <div className="flex gap-2">
          <select
            className="input flex-1"
            value={yearDraft}
            onChange={(e) => {
              setYearDraft(e.target.value)
              setYearMsg("")
            }}
            aria-label="admission year"
          >
            <option value="" disabled>
              year
            </option>
            {admissionYears.map((y) => (
              <option key={y} value={y}>
                {y}
              </option>
            ))}
          </select>
          <button
            className="btn-primary px-5 disabled:opacity-50"
            onClick={handleYearSave}
            disabled={!yearDraft || yearSaving}
          >
            {yearSaving ? "saving..." : "save"}
          </button>
        </div>
        {yearMsg && <p className="text-xs text-white/50 mt-2">{yearMsg}</p>}
      </div>

      <div className="card p-4 mb-3">
        <p className="font-semibold mb-1">🔔 notifications</p>
        {pushPermission === "denied" ? (
          <>
            <p className="text-sm text-white/60">blocked — enable in browser settings</p>
            <p className="text-xs text-white/40 mt-1">
              push is blocked for this site. open your browser&apos;s site settings for this app and allow
              notifications, then come back here.
            </p>
          </>
        ) : pushPermission === "granted" && pushSubscribed ? (
          <p className="text-sm text-[#baff39]">✓ enabled — you&apos;ll get notified even when the app is closed</p>
        ) : (
          <>
            <p className="text-sm text-white/50 mb-3">get notified even when the app is closed.</p>
            <button className="btn-primary w-full text-sm" onClick={handleEnablePush} disabled={pushBusy}>
              {pushBusy ? "enabling..." : "enable push notifications"}
            </button>
            {pushMessage && (
              <p className="text-xs text-red-300/80 mt-2" role="status">
                {pushMessage}
              </p>
            )}
          </>
        )}
      </div>

      <div className="card p-2 mb-3">
        <button
          className="w-full text-left py-2.5 px-3 rounded-xl hover:bg-white/5 text-sm flex items-center gap-2"
          onClick={() => router.push("/lair")}
        >
          👻 my lair <span className="text-white/30 text-xs ml-1">ghost name • storage</span>
          <span className="ml-auto text-white/20">›</span>
        </button>
        <button
          className="w-full text-left py-2.5 px-3 rounded-xl hover:bg-white/5 text-sm flex items-center gap-2"
          onClick={() => router.push("/shop")}
        >
          🛍️ shop <span className="text-white/30 text-xs ml-1">avatars • cosmetics</span>
          <span className="ml-auto text-white/20">›</span>
        </button>
        <button
          className="w-full text-left py-2.5 px-3 rounded-xl hover:bg-white/5 text-sm flex items-center gap-2"
          onClick={() => router.push("/upgrade")}
        >
          ⭐ plans <span className="text-white/30 text-xs ml-1">plus • prime</span>
          <span className="ml-auto text-white/20">›</span>
        </button>
        <button
          className="w-full text-left py-2.5 px-3 rounded-xl hover:bg-white/5 text-sm flex items-center gap-2"
          onClick={() => router.push("/notifications")}
        >
          🔔 notifications <span className="ml-auto text-white/20">›</span>
        </button>
      </div>

      <div className="card p-3 mb-3 border-red-500/20">
        <p className="font-semibold text-sm text-red-400">danger zone</p>
        <p className="text-xs text-white/40 mb-2">delete your account permanently. this can’t be undone.</p>
        <button className="btn-ghost w-full text-sm text-red-400" onClick={() => setShowDeleteModal(true)}>
          delete account
        </button>
      </div>

      <p className="text-[11px] text-white/25 text-center mt-4">
        ghost name, avatar and storage live in the lair — this page is just the easy door.
      </p>

      {showDeleteModal && (
        <div className="fixed inset-0 bg-black/70 flex items-center justify-center z-50 px-4">
          <div className="card p-5 w-full max-w-sm bg-black">
            <h3 className="font-bold text-lg mb-1">delete account</h3>
            <p className="text-white/50 text-sm mb-4">this action is irreversible. all your posts, votes, and data will be permanently deleted.</p>
            <input className="input mb-3" type="password" placeholder="password to confirm" value={deletePassword} onChange={(e) => setDeletePassword(e.target.value)} />
            <div className="flex gap-2">
              <button className="btn-ghost flex-1" onClick={() => { setShowDeleteModal(false); setDeletePassword("") }}>cancel</button>
              <button className="btn-primary flex-1" onClick={handleDeleteAccount} disabled={deleting}>
                {deleting ? "deleting..." : "delete account"}
              </button>
            </div>
          </div>
        </div>
      )}
    </main>
  )
}
