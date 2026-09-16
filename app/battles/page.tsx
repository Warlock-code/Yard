"use client"

import { useCallback, useEffect, useState } from "react"
import { apiGet, apiPost } from "@/lib/useApi"

type Entry = {
  id: string
  text: string
  votes: number
  isPrime: boolean
  user: { ghostId: string; avatarEmoji: string; tier: string }
}

type Prompt = {
  id: string
  text: string
  endsAt: string
}

export default function BattlesPage() {
  const [prompt, setPrompt] = useState<Prompt | null>(null)
  const [entries, setEntries] = useState<Entry[]>([])
  const [loading, setLoading] = useState(true)
  const [entryText, setEntryText] = useState("")
  const [submitting, setSubmitting] = useState(false)

  const load = useCallback((isCurrent: () => boolean = () => true) => {
    return apiGet("/api/battles")
      .then((data) => {
        if (!isCurrent()) return
        setPrompt(data.prompt)
        setEntries(data.entries)
      })
      .catch(console.error)
      .finally(() => {
        if (isCurrent()) setLoading(false)
      })
  }, [])

  useEffect(() => {
    let active = true
    load(() => active)
    return () => { active = false }
  }, [load])

  async function handleEnter() {
    if (!entryText.trim() || !prompt) return
    setSubmitting(true)
    try {
      await apiPost("/api/battles/enter", { promptId: prompt.id, text: entryText })
      setEntryText("")
      setLoading(true)
      load()
    } catch (err: unknown) {
      alert(err instanceof Error ? err.message : "Something went wrong.")
    } finally {
      setSubmitting(false)
    }
  }

  async function handleVote(entryId: string) {
    try {
      await apiPost("/api/battles/vote", { entryId })
      setEntries((prev) =>
        prev.map((e) => (e.id === entryId ? { ...e, votes: e.votes + 1 } : e)).sort((a, b) => b.votes - a.votes)
      )
    } catch (err: unknown) {
      alert(err instanceof Error ? err.message : "Something went wrong.")
    }
  }

  if (loading) return <p className="text-center text-white/40 mt-10">Loading battles...</p>

  return (
    <main className="min-h-screen max-w-lg mx-auto pb-24 px-4">
      <h1 className="text-2xl font-black mt-4 mb-1">⚔️ Battles</h1>

      {!prompt ? (
        <div className="text-center mt-14 px-8">
          <p className="text-3xl mb-3">⚔️</p>
          <p className="text-white/50 text-sm">No battle running right now. Check back soon, or ask an admin to start one.</p>
        </div>
      ) : (
        <>
          <div className="card p-4 mt-3">
            <p className="text-xs text-white/40 mb-1">Today&apos;s prompt</p>
            <p className="font-semibold">{prompt.text}</p>
          </div>

          <div className="card p-4 mt-3">
            <textarea
              className="input resize-none"
              rows={2}
              placeholder="Enter your take..."
              value={entryText}
              onChange={(e) => setEntryText(e.target.value)}
            />
            <button
              className="btn-primary w-full mt-2"
              onClick={handleEnter}
              disabled={submitting || !entryText.trim()}
            >
              {submitting ? "Entering..." : "Enter Battle"}
            </button>
          </div>

          <div className="mt-4 space-y-3">
            {entries.length === 0 ? (
              <p className="text-white/30 text-sm text-center mt-6">No entries yet — be the first.</p>
            ) : (
              entries.map((entry, i) => (
                <div key={entry.id} className="card p-4">
                  <div className="flex items-center gap-2 mb-2">
                    <span className="text-white/40 text-sm font-bold">#{i + 1}</span>
                    <span className="text-lg">{entry.user.avatarEmoji}</span>
                    <span className="font-semibold text-sm">{entry.user.ghostId}</span>
                    {entry.user.tier === "PRIME" && <span className="badge badge-prime">Prime</span>}
                  </div>
                  <p className="text-white/90 mb-3">{entry.text}</p>
                  <button
                    onClick={() => handleVote(entry.id)}
                    className="btn-ghost text-sm"
                  >
                    🔥 Vote ({entry.votes})
                  </button>
                </div>
              ))
            )}
          </div>
        </>
      )}
    </main>
  )
}