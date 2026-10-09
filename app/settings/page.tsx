"use client"

import { useCallback, useEffect, useMemo, useState } from "react"
import { useRouter } from "next/navigation"
import { apiGet, apiPatch } from "@/lib/useApi"
import Avatar from "@/app/components/Avatar"

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

      <div className="card p-2 mb-3">
        <button
          className="w-full text-left py-2.5 px-3 rounded-xl hover:bg-white/5 text-sm flex items-center gap-2"
          onClick={() => router.push("/lair")}
        >
          👻 my lair <span className="text-white/30 text-xs ml-1">inbox • ghost name • storage</span>
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

      <p className="text-[11px] text-white/25 text-center mt-4">
        ghost name, avatar, storage and delete still live in the lair — this page is just the easy door.
      </p>
    </main>
  )
}
