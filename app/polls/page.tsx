"use client"

import { useEffect, useState } from "react"
import { useRouter } from "next/navigation"
import { apiGet, apiPost, isNeedsCreditsError } from "@/lib/useApi"

type Poll = {
  id: string
  question: string
  options: string[]
  counts: number[]
  total: number
  endsAt: string
  voted?: boolean
}

export default function PollsPage() {
  const router = useRouter()
  const [polls, setPolls] = useState<Poll[]>([])
  const [loading, setLoading] = useState(true)
  const [question, setQuestion] = useState("")
  const [options, setOptions] = useState(["", ""])
  const [creating, setCreating] = useState(false)
  const [showForm, setShowForm] = useState(false)

  function load() {
    apiGet<{ polls: Poll[] }>("/api/polls")
      .then((d) => setPolls(d.polls || []))
      .catch(() => {})
      .finally(() => setLoading(false))
  }

  useEffect(() => {
    load()
  }, [])

  async function create() {
    const opts = options.map((o) => o.trim()).filter(Boolean)
    if (!question.trim() || opts.length < 2 || creating) return
    setCreating(true)
    try {
      await apiPost("/api/polls", { question, options: opts })
      setQuestion("")
      setOptions(["", ""])
      setShowForm(false)
      load()
    } catch (err: unknown) {
      if (!isNeedsCreditsError(err)) alert(err instanceof Error ? err.message : "failed.")
    } finally {
      setCreating(false)
    }
  }

  async function vote(id: string, optionIdx: number) {
    try {
      await apiPost(`/api/polls/${id}/vote`, { optionIdx })
      load()
    } catch (err: unknown) {
      alert(err instanceof Error ? err.message : "vote failed.")
    }
  }

  return (
    <main className="min-h-screen max-w-lg mx-auto pb-28 px-4">
      <div className="flex items-center gap-3 pt-5 pb-1">
        <button onClick={() => router.back()} className="text-white/60">←</button>
        <h1 className="text-xl font-bold">📊 polls</h1>
      </div>
      <div className="flex items-center justify-between mb-3">
        <p className="text-white/40 text-sm">campus votes on everything. voting is free.</p>
        <button className="btn-ghost !py-1.5 !px-3 !text-xs" onClick={() => setShowForm((v) => !v)}>
          {showForm ? "close" : "+ new · 100cr"}
        </button>
      </div>

      {showForm && (
        <div className="card p-4 mb-3 space-y-2">
          <input className="input" placeholder="question — e.g. best night shuttle?" value={question} onChange={(e) => setQuestion(e.target.value.toLowerCase())} />
          {options.map((o, i) => (
            <input
              key={i}
              className="input"
              placeholder={`option ${i + 1}`}
              value={o}
              onChange={(e) => setOptions((prev) => prev.map((p, j) => (j === i ? e.target.value.toLowerCase() : p)))}
            />
          ))}
          {options.length < 4 && (
            <button className="text-xs text-white/50" onClick={() => setOptions((p) => [...p, ""])}>
              + add option
            </button>
          )}
          <button className="btn-primary w-full" onClick={create} disabled={creating}>
            {creating ? "creating…" : "create poll · 100cr"}
          </button>
        </div>
      )}

      {loading ? (
        <p className="text-center text-white/40 mt-10">loading polls…</p>
      ) : polls.length === 0 ? (
        <p className="text-white/30 text-sm text-center mt-8">no live polls — start one 👻</p>
      ) : (
        <div className="space-y-2">
          {polls.map((p) => (
            <div key={p.id} className="card p-4">
              <p className="font-semibold text-sm mb-2">{p.question}</p>
              <div className="space-y-1.5">
                {p.options.map((o, i) => {
                  const pct = p.total > 0 ? Math.round((p.counts[i] / p.total) * 100) : 0
                  return (
                    <button
                      key={i}
                      disabled={!!p.voted}
                      onClick={() => vote(p.id, i)}
                      className="w-full text-left rounded-xl border border-white/10 bg-black/30 px-3 py-2 hover:border-[#baff39]/40 disabled:opacity-80"
                    >
                      <div className="flex items-center justify-between text-sm">
                        <span>{o}</span>
                        <span className="text-white/50 text-xs">{p.counts[i]} · {pct}%</span>
                      </div>
                      <div className="h-1 rounded-full bg-white/[0.07] mt-1.5 overflow-hidden">
                        <div className="h-full rounded-full bg-[#baff39]" style={{ width: `${pct}%` }} />
                      </div>
                    </button>
                  )
                })}
              </div>
              <p className="text-[11px] text-white/30 mt-2">
                {p.total} votes · ends {new Date(p.endsAt).toLocaleString()}
                {p.voted ? " · you voted ✓" : ""}
              </p>
            </div>
          ))}
        </div>
      )}
    </main>
  )
}
