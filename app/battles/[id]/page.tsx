"use client"

import { useCallback, useEffect, useState } from "react"
import Link from "next/link"
import { useParams } from "next/navigation"
import { apiGet, apiPost } from "@/lib/useApi"
import ChampionTrophies from "@/app/components/ChampionTrophies"

type Entry = {
  id: string
  text: string | null
  imageUrl: string | null
  voiceUrl: string | null
  votes: number
  user: { ghostId: string; avatarEmoji: string; tier: string; championTrophies?: number }
}

type Prompt = {
  id: string
  text: string
  endsAt: string
  status: string
  entries: Entry[]
}

export default function BattleDetailPage() {
  const params = useParams<{ id: string }>()
  const id = Array.isArray(params?.id) ? params.id[0] : params?.id
  const [prompt, setPrompt] = useState<Prompt | null>(null)
  const [loading, setLoading] = useState(true)
  const [notFound, setNotFound] = useState(false)

  const load = useCallback(() => {
    if (!id) return
    setLoading(true)
    setNotFound(false)
    apiGet<{ prompt: Prompt | null; entries?: Entry[] }>(`/api/battles?promptId=${encodeURIComponent(id)}`)
      .then((data) => {
        if (!data.prompt) {
          setNotFound(true)
          setPrompt(null)
          return
        }
        const entries = Array.isArray((data.prompt as Prompt).entries)
          ? (data.prompt as Prompt).entries
          : (data.entries ?? [])
        setPrompt({ ...(data.prompt as Prompt), entries })
      })
      .catch((err: unknown) => {
        if (err instanceof Error && (err.message.includes("not found") || err.message.includes("404"))) {
          setNotFound(true)
        } else {
          console.error(err)
          setNotFound(true)
        }
      })
      .finally(() => setLoading(false))
  }, [id])

  useEffect(() => {
    load()
  }, [load])

  async function handleVote(entryId: string) {
    try {
      await apiPost("/api/battles/vote", { entryId })
      setPrompt((prev) =>
        prev ? { ...prev, entries: prev.entries.map((e) => (e.id === entryId ? { ...e, votes: e.votes + 1 } : e)).sort((a, b) => b.votes - a.votes) } : prev
      )
    } catch (err: unknown) {
      alert(err instanceof Error ? err.message : "something went wrong.")
    }
  }

  if (loading) return <p className="text-center text-white/40 mt-10">loading battle...</p>

  if (notFound || !prompt) {
    return (
      <main className="min-h-screen max-w-lg mx-auto pb-24 px-4">
        <div className="text-center mt-14 px-8">
          <p className="text-3xl mb-3">⚔️</p>
          <p className="font-bold text-white/80 text-sm">battle not found.</p>
          <p className="text-white/40 text-xs mt-1 mb-4">it may have expired or the link is wrong.</p>
          <Link href="/battles" className="btn-ghost text-xs">← back to battles</Link>
        </div>
      </main>
    )
  }

  return (
    <main className="min-h-screen max-w-lg mx-auto pb-24 px-4">
      <div className="flex items-center justify-between mt-4 mb-1">
        <Link href="/battles" className="text-xs font-bold text-white/50 hover:text-[#baff39]">
          ← battles
        </Link>
        <Link href="/battles/history" className="text-xs font-bold text-white/50 hover:text-[#baff39]">
          history →
        </Link>
      </div>
      <div className="card p-4 mt-3">
        <p className="text-xs text-white/40 mb-1">battle prompt</p>
        <p className="post-mono font-semibold">{prompt.text}</p>
        <p className="text-xs text-white/40 mt-1">ends {new Date(prompt.endsAt).toLocaleString()} · {prompt.status}</p>
      </div>
      <div className="mt-4 space-y-3">
        {prompt.entries.length === 0 ? (
          <p className="text-white/30 text-sm text-center mt-6">no entries yet — be the first.</p>
        ) : (
          prompt.entries.map((entry, i) => (
            <div key={entry.id} className="card p-4">
              <div className="flex items-center gap-2 mb-2">
                <span className="text-white/40 text-sm font-bold">#{i + 1}</span>
                <span className="text-lg">{entry.user.avatarEmoji}</span>
                <Link href={`/u/${encodeURIComponent(entry.user.ghostId)}`} className="font-semibold text-sm">
                  {entry.user.ghostId}
                </Link>
                {entry.user.tier === "PLUS" && <span className="badge badge-plus">✓ plus</span>}
                {entry.user.tier === "PRIME" && <span className="badge badge-prime">👑 prime</span>}
                <ChampionTrophies trophies={entry.user.championTrophies} />
              </div>
              {entry.imageUrl ? (
                <img src={entry.imageUrl} alt="battle entry" className="mb-3 max-h-64 rounded-lg border border-white/10 object-cover" loading="lazy" />
              ) : entry.voiceUrl ? (
                <audio src={entry.voiceUrl} controls className="mb-3 w-full" />
              ) : (
                <p className="post-mono text-white/90 mb-3">{entry.text}</p>
              )}
              <button onClick={() => handleVote(entry.id)} className="btn-ghost text-sm">
                🔥 vote ({entry.votes})
              </button>
            </div>
          ))
        )}
      </div>
    </main>
  )
}
