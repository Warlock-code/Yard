"use client"

import { useCallback, useEffect, useState } from "react"
import Link from "next/link"
import { apiGet } from "@/lib/useApi"
import { entryRevealVariants, staggerContainer } from "@/lib/battleAnimations"
import { motion } from "framer-motion"

type Entry = {
  id: string
  text: string | null
  imageUrl: string | null
  voiceUrl: string | null
  entryType: string
  votes: number
  wonRound: boolean
  user: { ghostId: string; avatarEmoji: string; tier: string }
}

type Battle = {
  id: string
  text: string
  type: string
  status: string
  startsAt: string
  endsAt: string
  roundNumber: number
  totalRounds: number
  isPrimeOnly: boolean
  earlyAccessForPrime: boolean
  entryType: string
  winnerEntryId: string | null
  season: { id: string; name: string } | null
  entries: Entry[]
  winnerEntry: Entry | null
  childPrompts: Battle[]
  parentPrompt: Battle | null
}

export default function BattleHistoryPage() {
  const [battles, setBattles] = useState<Battle[]>([])
  const [loading, setLoading] = useState(true)
  const [filter, setFilter] = useState<"all" | "won" | "entered">("all")
  const [expandedBattle, setExpandedBattle] = useState<string | null>(null)

  const load = useCallback(async () => {
    try {
      const data = await apiGet("/api/battles?history=true")
      setBattles(data.battles || [])
    } catch (err) {
      console.error("Failed to load battle history:", err)
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => {
    load()
  }, [load])

  const filteredBattles = battles.filter((battle) => {
    if (filter === "won") return battle.winnerEntry?.user?.ghostId === "current-user"
    if (filter === "entered") return battle.entries.some((e) => e.user.ghostId === "current-user")
    return true
  })

  if (loading) return <p className="text-center text-white/40 mt-10">Loading history...</p>

  return (
    <main className="min-h-screen max-w-lg mx-auto pb-24 px-4">
      <div className="flex items-center justify-between mt-4 mb-4">
        <h1 className="text-2xl font-black">⚔️ Battle History</h1>
      </div>

      <div className="flex gap-2 mb-4" role="tablist">
        {["all", "won", "entered"].map((f) => (
          <button
            key={f}
            role="tab"
            aria-selected={filter === f}
            onClick={() => setFilter(f as typeof filter)}
            className={`flex-1 px-4 py-2 rounded-full text-sm font-semibold transition-colors ${
              filter === f
                ? "bg-[#baff39] text-black"
                : "bg-white/5 text-white/60 hover:text-white"
            }`}
          >
            {f.charAt(0).toUpperCase() + f.slice(1)}
          </button>
        ))}
      </div>

      {filteredBattles.length === 0 ? (
        <div className="text-center mt-14 px-8">
          <p className="text-3xl mb-3">📜</p>
          <p className="text-white/50 text-sm">No past battles yet. Enter a battle to make history!</p>
        </div>
      ) : (
        <motion.ul
          className="space-y-4"
          variants={staggerContainer}
          initial="hidden"
          animate="visible"
        >
          {filteredBattles.map((battle, index) => (
            <motion.li
              key={battle.id}
              variants={entryRevealVariants}
              className="card overflow-hidden"
            >
              <button
                onClick={() => setExpandedBattle(expandedBattle === battle.id ? null : battle.id)}
                className="w-full p-4 flex items-center justify-between text-left"
                aria-expanded={expandedBattle === battle.id}
              >
                <div className="flex items-center gap-3">
                  <span className="text-white/40 text-sm font-bold">⚔️</span>
                  <div>
                    <p className="font-semibold text-white truncate max-w-[200px]">{battle.text}</p>
                    <p className="text-xs text-white/40">
                      {new Date(battle.startsAt).toLocaleDateString()} · Round {battle.roundNumber} of {battle.totalRounds}
                      {battle.isPrimeOnly && <span className="ml-2 badge badge-prime">Prime Only</span>}
                      {battle.earlyAccessForPrime && <span className="ml-2 badge badge-prime">Early Access</span>}
                    </p>
                  </div>
                </div>
                <span className="text-white/40 transition-transform duration-200">
                  {expandedBattle === battle.id ? "▲" : "▼"}
                </span>
              </button>

              {expandedBattle === battle.id && (
                <motion.div
                  initial={{ height: 0, opacity: 0 }}
                  animate={{ height: "auto", opacity: 1 }}
                  exit={{ height: 0, opacity: 0 }}
                  transition={{ duration: 0.3, ease: "easeInOut" }}
                  className="border-t border-white/10"
                >
                  <div className="p-4 space-y-3">
                    {battle.winnerEntry && (
                      <div className="card p-3 relative" style={{ borderColor: "rgba(186,255,57,0.5)", background: "rgba(186,255,57,0.05)" }}>
                        <span className="absolute -top-2 left-3 badge badge-prime text-xs">🏆 Winner</span>
                        <div className="flex items-center gap-2 mt-2">
                          <span className="text-lg">{battle.winnerEntry.user.avatarEmoji}</span>
                          <span className="font-semibold">{battle.winnerEntry.user.ghostId}</span>
                          {battle.winnerEntry.user.tier === "PRIME" && <span className="badge badge-prime">Prime</span>}
                        </div>
                        <p className="text-white/80 text-sm mt-2">
                          {battle.winnerEntry.text || battle.winnerEntry.imageUrl ? "📷 Image entry" : battle.winnerEntry.voiceUrl ? "🎤 Voice entry" : ""}
                        </p>
                        <p className="text-xs text-white/40 mt-1">🔥 {battle.winnerEntry.votes} votes</p>
                      </div>
                    )}

                    <p className="text-xs text-white/40 mb-2">All Entries ({battle.entries.length})</p>
                    <div className="space-y-2 max-h-60 overflow-y-auto">
                      {battle.entries.map((entry, i) => (
                        <div
                          key={entry.id}
                          className={`card p-3 flex items-center gap-3 ${
                            entry.wonRound ? "border-[#baff39]/50 bg-[#baff39]/10" : ""
                          }`}
                        >
                          <span className="text-white/40 text-sm font-bold w-6 text-right">#{i + 1}</span>
                          <span className="text-lg">{entry.user.avatarEmoji}</span>
                          <div className="flex-1 min-w-0">
                            <p className="font-semibold text-sm truncate">{entry.user.ghostId}</p>
                            <p className="text-white/60 text-xs truncate">
                              {entry.text || entry.imageUrl ? "📷 Image" : entry.voiceUrl ? "🎤 Voice" : ""}
                            </p>
                          </div>
                          <div className="text-right">
                            <p className="font-bold text-[#baff39]">🔥 {entry.votes}</p>
                            {entry.wonRound && <span className="badge badge-prime text-xs">Advanced</span>}
                          </div>
                        </div>
                      ))}
                    </div>

                    {battle.childPrompts.length > 0 && (
                      <div className="pt-3 border-t border-white/10">
                        <p className="text-xs text-white/40 mb-2">Subsequent Rounds</p>
                        <div className="space-y-2">
                          {battle.childPrompts.map((round) => (
                            <Link
                              key={round.id}
                              href={`/battles/${round.id}`}
                              className="card p-3 flex items-center justify-between hover:bg-white/5 transition-colors"
                            >
                              <div className="flex items-center gap-2">
                                <span className="badge badge-prime text-xs">Round {round.roundNumber}</span>
                                <p className="text-white/80 text-sm truncate max-w-[180px]">{round.text}</p>
                              </div>
                              {round.winnerEntry && (
                                <div className="flex items-center gap-2 text-right">
                                  <span className="text-lg">{round.winnerEntry.user.avatarEmoji}</span>
                                  <span className="text-white/60 text-sm">{round.winnerEntry.user.ghostId}</span>
                                  <span className="font-bold text-[#baff39]">🔥 {round.winnerEntry.votes}</span>
                                </div>
                              )}
                            </Link>
                          ))}
                        </div>
                      </div>
                    )}
                  </div>
                </motion.div>
              )}
            </motion.li>
          ))}
        </motion.ul>
      )}
    </main>
  )
}