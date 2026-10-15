"use client"

import { useCallback, useEffect, useState } from "react"
import Link from "next/link"
import { apiGet, apiPost, isNeedsCreditsError } from "@/lib/useApi"
import { CREDIT_CONFIG } from "@/lib/credit-config"
import { shareContent, getShareTargets } from "@/lib/share"
import { useSocket } from "@/lib/socket"
import ChampionTrophies from "@/app/components/ChampionTrophies"

type Entry = {
  id: string
  text: string
  votes: number
  isPrime: boolean
  user: { ghostId: string; avatarEmoji: string; tier: string; championTrophies?: number }
}

type Prompt = {
  id: string
  text: string
  endsAt: string
}

import React from "react"

export default function BattlesClient() {
  const [prompt, setPrompt] = useState<Prompt | null>(null)
  const [entries, setEntries] = useState<Entry[]>([])
  const [loading, setLoading] = useState(true)
  const [entryText, setEntryText] = useState("")
  const [submitting, setSubmitting] = useState(false)
  const [showShareMenu, setShowShareMenu] = useState(false)
  const [now, setNow] = useState(() => Date.now())

  const { connected, on, joinBattle, leaveBattle } = useSocket()

  const load = useCallback((isCurrent: () => boolean = () => true) => {
    return apiGet<{ prompt: Prompt | null; entries: Entry[] }>("/api/battles")
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

  // Tick the countdown while a battle is live (cheap 30s interval, page-only).
  useEffect(() => {
    if (!prompt) return
    const t = setInterval(() => setNow(Date.now()), 30_000)
    return () => clearInterval(t)
  }, [prompt])

  useEffect(() => {
    if (!prompt?.id) return
    joinBattle(prompt.id)
    return () => leaveBattle(prompt.id)
  }, [prompt?.id, joinBattle, leaveBattle])

  useEffect(() => {
    if (!connected || !prompt?.id) return
    const unsubVote = on("battle_vote", ({ entryId, votes }: { entryId: string; votes: number }) => {
      setEntries((prev) =>
        prev.map((e) => (e.id === entryId ? { ...e, votes } : e)).sort((a, b) => b.votes - a.votes)
      )
    })
    const unsubUpdate = on("battle_update", (data: { entries?: Entry[] }) => {
      if (data.entries) {
        setEntries(data.entries)
      }
    })
    return () => {
      unsubVote()
      unsubUpdate()
    }
  }, [connected, on, prompt?.id])

  async function handleEnter() {
    if (!entryText.trim() || !prompt) return
    setSubmitting(true)
    try {
      await apiPost("/api/battles/enter", { promptId: prompt.id, text: entryText.toLowerCase() })
      setEntryText("")
      setLoading(true)
      load()
    } catch (err: unknown) {
      // Insufficient credits already redirected to /shop by the api client.
      if (isNeedsCreditsError(err)) return
      alert(err instanceof Error ? err.message : "something went wrong.")
    } finally {
      setSubmitting(false)
    }
  }

  const potCredits = entries.length * CREDIT_CONFIG.SPEND.BATTLE_ENTRY_PREMIUM

  async function handleVote(entryId: string) {
    try {
      await apiPost("/api/battles/vote", { entryId })
      setEntries((prev) =>
        prev.map((e) => (e.id === entryId ? { ...e, votes: e.votes + 1 } : e)).sort((a, b) => b.votes - a.votes)
      )
    } catch (err: unknown) {
      alert(err instanceof Error ? err.message : "something went wrong.")
    }
  }

  if (loading) return <p className="text-center text-white/40 mt-10">loading battles...</p>

  return (
    <main className="min-h-screen max-w-lg mx-auto pb-24 px-4">
      <div className="flex items-center justify-between mt-4 mb-1">
        <h1 className="text-2xl font-black">⚔️ battles</h1>
        <Link href="/battles/history" className="text-xs font-bold text-white/50 hover:text-[#baff39]">
          history →
        </Link>
      </div>

      {!prompt ? (
        <div className="text-center mt-14 px-8">
          <p className="text-3xl mb-3">⚔️</p>
          <p className="text-white/50 text-sm">no battle running right now. check back soon.</p>
        </div>
      ) : (
        <React.Fragment>
          <div className="card p-4 mt-3 flex items-center justify-between">
            <div>
              <p className="text-xs text-white/40 mb-1">today&apos;s prompt</p>
              <p className="post-mono font-semibold">{prompt.text}</p>
              <BattleCountdown endsAt={prompt.endsAt} now={now} />
              <p className="text-xs font-bold text-[#baff39] mt-1">
                🔥 {potCredits.toLocaleString()}cr pot — {entries.length} {entries.length === 1 ? "entry" : "entries"} · winner takes 75%
              </p>
            </div>
            <BattleShareButton onClick={() => setShowShareMenu(true)} />
          </div>

          <div className="card p-4 mt-3">
            <textarea
              className="input resize-none"
              rows={2}
              placeholder="enter your take..."
              value={entryText}
              onChange={(e) => setEntryText(e.target.value.toLowerCase())}
            />
            <button
              className="btn-primary w-full mt-2"
              onClick={handleEnter}
              disabled={submitting || !entryText.trim()}
            >
              {submitting ? "entering..." : `enter battle · ${CREDIT_CONFIG.SPEND.BATTLE_ENTRY_PREMIUM}cr (prime: 1 free/day)`}
            </button>
          </div>

          <div className="mt-4 space-y-3">
            {entries.length === 0 ? (
              <p className="text-white/30 text-sm text-center mt-6">no entries yet — be the first.</p>
            ) : (
              entries.map((entry, i) => (
                <div key={entry.id} className="card p-4">
                  <div className="flex items-center gap-2 mb-2">
                    <span className="text-white/40 text-sm font-bold">#{i + 1}</span>
                    <Link href={`/u/${encodeURIComponent(entry.user.ghostId)}`} aria-label={`view ${entry.user.ghostId}'s profile`} className="focus-visible:outline-[#baff39]">
                      <span className="text-lg">{entry.user.avatarEmoji}</span>
                    </Link>
                    <Link href={`/u/${encodeURIComponent(entry.user.ghostId)}`} aria-label={`view ${entry.user.ghostId}'s profile`} className="font-semibold text-sm focus-visible:outline-[#baff39]">
                      {entry.user.ghostId}
                    </Link>
                    {entry.user.tier === "PLUS" && <span className="badge badge-plus">✓ plus</span>}
                    {entry.user.tier === "PRIME" && <span className="badge badge-prime">👑 prime</span>}
                    <ChampionTrophies trophies={entry.user.championTrophies} />
                  </div>
                  <p className="post-mono text-white/90 mb-3">{entry.text}</p>
                  <button
                    onClick={() => handleVote(entry.id)}
                    className="btn-ghost text-sm"
                  >
                    🔥 vote ({entry.votes})
                  </button>
                </div>
              ))
            )}
          </div>

          {showShareMenu && <BattleShareMenu promptId={prompt.id} promptText={prompt.text} onClose={() => setShowShareMenu(false)} />}
        </React.Fragment>
      )}

      <DuelSection />
    </main>
  )
}

function BattleCountdown({ endsAt, now }: { endsAt: string; now: number }) {
  const diff = new Date(endsAt).getTime() - now
  if (!Number.isFinite(diff) || diff <= 0) {
    return <p className="text-xs font-bold text-red-400 mt-1">ends now — last votes!</p>
  }
  const mins = Math.floor(diff / 60_000)
  const label = mins < 60 ? `ends in ${mins}m` : mins < 1440 ? `ends in ${Math.floor(mins / 60)}h ${mins % 60}m` : `ends in ${Math.floor(mins / 1440)}d`
  const urgent = diff < 6 * 60 * 60 * 1000
  return (
    <p className={`text-xs mt-1 font-semibold ${urgent ? "text-amber-300 animate-pulse" : "text-white/40"}`}>
      {urgent ? `🔥 ${label} — vote now` : `⏳ ${label}`}
    </p>
  )
}

function BattleShareButton({ onClick }: { onClick: () => void }) {
  return (
    <button onClick={onClick} className="btn-ghost !py-1.5 !px-3 !text-xs shrink-0" aria-label="share battle">
      🔗 share
    </button>
  )
}

function BattleShareMenu({ promptId, promptText, onClose }: { promptId: string; promptText: string; onClose: () => void }) {
  const targets = getShareTargets()

  return (
    <div className="fixed inset-0 z-50 flex items-end justify-center px-4 pb-4" onClick={onClose}>
      <div className="absolute inset-0 bg-black/50" onClick={onClose} />
      <div className="relative card p-4 w-full max-w-sm shadow-xl border border-white/10 animate-slide-up">
        <div className="flex items-center justify-between mb-4">
          <h3 className="font-semibold">share battle</h3>
          <button onClick={onClose} className="text-white/50 hover:text-white" aria-label="close">✕</button>
        </div>
        <div className="grid grid-cols-2 gap-2">
          {targets.map((target) => (
            <button
              key={target}
              onClick={() => {
                shareContent({ type: "battle", id: promptId, text: promptText }, target)
                onClose()
              }}
              className="px-4 py-3 text-sm text-white/90 hover:bg-white/10 rounded border border-white/10 focus-visible:outline-[#baff39]"
            >
              {target === "native" && "📤 native share"}
              {target === "whatsapp" && "💬 whatsapp"}
              {target === "twitter" && "🐦 x (twitter)"}
              {target === "copy" && "📋 copy link"}
            </button>
          ))}
        </div>
      </div>
    </div>
  )
}

type Duel = {
  id: string
  text: string
  status: string
  endsAt: string
  entries: Entry[]
  entryCount: number
  open: boolean
  potCredits: number
  winnerPot: number
}

function DuelSection() {
  const [duels, setDuels] = useState<Duel[]>([])
  const [open, setOpen] = useState(false)
  const [prompt, setPrompt] = useState("")
  const [take, setTake] = useState("")
  const [opponent, setOpponent] = useState("")
  const [busy, setBusy] = useState(false)
  const [acceptTake, setAcceptTake] = useState<Record<string, string>>({})

  const load = useCallback(() => {
    apiGet<{ duels: Duel[] }>("/api/duels")
      .then((d) => setDuels(d.duels || []))
      .catch(() => {})
  }, [])

  useEffect(() => {
    load()
  }, [load])

  async function create() {
    if (!prompt.trim() || !take.trim() || busy) return
    setBusy(true)
    try {
      await apiPost("/api/duels", { text: prompt, take, opponentGhostId: opponent || undefined })
      setPrompt("")
      setTake("")
      setOpponent("")
      setOpen(false)
      load()
    } catch (err: unknown) {
      if (!isNeedsCreditsError(err)) alert(err instanceof Error ? err.message : "failed.")
    } finally {
      setBusy(false)
    }
  }

  async function accept(id: string) {
    const t = (acceptTake[id] || "").trim()
    if (!t || busy) return
    setBusy(true)
    try {
      await apiPost(`/api/duels/${id}/accept`, { take: t })
      setAcceptTake((p) => ({ ...p, [id]: "" }))
      load()
    } catch (err: unknown) {
      if (!isNeedsCreditsError(err)) alert(err instanceof Error ? err.message : "failed.")
    } finally {
      setBusy(false)
    }
  }

  return (
    <div className="card p-4 mt-4">
      <div className="flex items-center justify-between">
        <div>
          <p className="font-bold">⚔️ ghost duels</p>
          <p className="text-xs text-white/40">1v1 · 500cr each · winner takes 750cr (75%) · votes free · public, ghostId only, no DMs</p>
        </div>
        <button className="btn-ghost !py-1.5 !px-3 !text-xs" onClick={() => setOpen((v) => !v)}>
          {open ? "close" : "start a duel"}
        </button>
      </div>

      {open && (
        <div className="mt-3 space-y-2">
          <input
            className="input"
            placeholder="duel prompt — e.g. best jollof spot?"
            value={prompt}
            onChange={(e) => setPrompt(e.target.value.toLowerCase())}
          />
          <textarea
            className="input resize-none"
            rows={2}
            placeholder="your take (500cr to enter)"
            value={take}
            onChange={(e) => setTake(e.target.value.toLowerCase())}
          />
          <input
            className="input"
            placeholder="opponent ghost (optional — blank = open duel)"
            value={opponent}
            onChange={(e) => setOpponent(e.target.value.toLowerCase())}
          />
          <button className="btn-primary w-full" onClick={create} disabled={busy || !prompt.trim() || !take.trim()}>
            {busy ? "starting…" : `challenge · ${CREDIT_CONFIG.SPEND.DUEL_ENTRY}cr`}
          </button>
        </div>
      )}

      {duels.length > 0 && (
        <div className="mt-3 space-y-2">
          {duels.map((d) => (
            <div key={d.id} className="rounded-xl border border-white/10 bg-black/30 p-3">
              <p className="text-sm font-semibold">{d.text}</p>
              <p className="text-[11px] font-bold text-[#baff39] mt-0.5">
                🔥 {d.potCredits.toLocaleString()}cr pot — {d.entryCount}/2 {d.entryCount === 1 ? "entry" : "entries"} · winner takes {d.winnerPot.toLocaleString()}cr
              </p>
              {d.status === "COMPLETED" && d.entries.length > 0 && (
                <p className="text-[11px] font-bold text-[#facc15] mt-0.5">
                  🏆 {d.entries[0].user.ghostId} wins {d.winnerPot.toLocaleString()}cr
                </p>
              )}
              <div className="mt-2 space-y-1.5">
                {d.entries.map((e) => (
                  <div key={e.id} className="flex items-center gap-2 text-sm">
                    <span>{e.user.avatarEmoji}</span>
                    <Link href={`/u/${encodeURIComponent(e.user.ghostId)}`} className="font-semibold focus-visible:outline-[#baff39]">
                      {e.user.ghostId}
                    </Link>
                    <span className="text-white/40 text-xs truncate flex-1">{e.text}</span>
                    <button className="btn-ghost !py-1 !px-2 !text-xs" onClick={() => apiPost(`/api/duels/${d.id}/vote`, { entryId: e.id }).then(() => load()).catch((err: unknown) => { if (!isNeedsCreditsError(err)) alert(err instanceof Error ? err.message : "vote failed.") })}>
                      🔥 {e.votes}
                    </button>
                  </div>
                ))}
              </div>
              {d.open && (
                <div className="mt-2 flex gap-2">
                  <input
                    className="input !py-2 text-sm"
                    placeholder="your take to accept (500cr)"
                    value={acceptTake[d.id] || ""}
                    onChange={(e) => setAcceptTake((p) => ({ ...p, [d.id]: e.target.value.toLowerCase() }))}
                  />
                  <button className="btn-primary !py-2 !px-4 text-sm shrink-0" onClick={() => accept(d.id)} disabled={busy}>
                    accept
                  </button>
                </div>
              )}
            </div>
          ))}
        </div>
      )}
    </div>
  )
}