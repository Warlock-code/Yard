"use client"

import { useCallback, useEffect, useState } from "react"
import Link from "next/link"
import { apiGet, apiPost } from "@/lib/useApi"
import { shareContent, getShareTargets, ShareTarget } from "@/lib/share"
import { useSocket } from "@/lib/socket"

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

import React from "react"

export default function BattlesClient() {
  const [prompt, setPrompt] = useState<Prompt | null>(null)
  const [entries, setEntries] = useState<Entry[]>([])
  const [loading, setLoading] = useState(true)
  const [entryText, setEntryText] = useState("")
  const [submitting, setSubmitting] = useState(false)
  const [showShareMenu, setShowShareMenu] = useState(false)

  const { connected, on, joinBattle, leaveBattle } = useSocket()

  async function handleShare(target: ShareTarget) {
    if (!prompt) return
    try {
      await shareContent({ type: "battle", id: prompt.id, text: prompt.text }, target)
      setShowShareMenu(false)
    } catch (err) {
      console.error("Share failed:", err)
    }
  }

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
        <React.Fragment>
          <div className="card p-4 mt-3 flex items-center justify-between">
            <div>
              <p className="text-xs text-white/40 mb-1">Today&apos;s prompt</p>
              <p className="font-semibold">{prompt.text}</p>
            </div>
            <BattleShareButton promptId={prompt.id} promptText={prompt.text} onClick={() => setShowShareMenu(true)} />
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
                    <Link href={`/u/${encodeURIComponent(entry.user.ghostId)}`} aria-label={`View ${entry.user.ghostId}'s profile`} className="focus-visible:outline-[#baff39]">
                      <span className="text-lg">{entry.user.avatarEmoji}</span>
                    </Link>
                    <Link href={`/u/${encodeURIComponent(entry.user.ghostId)}`} aria-label={`View ${entry.user.ghostId}'s profile`} className="font-semibold text-sm focus-visible:outline-[#baff39]">
                      {entry.user.ghostId}
                    </Link>
                    {entry.user.tier === "PRIME" && <span className="badge badge-prime">Prime</span>}
                    {entry.user.tier === "PLUS" && <span className="badge badge-plus">✓ Plus</span>}
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

          {showShareMenu && <BattleShareMenu promptId={prompt.id} promptText={prompt.text} onClose={() => setShowShareMenu(false)} />}
        </React.Fragment>
      )}
    </main>
  )
}

function BattleShareButton({ promptId, promptText, onClick }: { promptId: string; promptText: string; onClick: () => void }) {
  return (
    <button onClick={onClick} className="btn-ghost text-sm px-4" aria-label="Share battle">
      🔗 Share
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
          <h3 className="font-semibold">Share Battle</h3>
          <button onClick={onClose} className="text-white/50 hover:text-white" aria-label="Close">✕</button>
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
              {target === "native" && "📤 Native Share"}
              {target === "whatsapp" && "💬 WhatsApp"}
              {target === "twitter" && "🐦 X (Twitter)"}
              {target === "copy" && "📋 Copy Link"}
            </button>
          ))}
        </div>
      </div>
    </div>
  )
}