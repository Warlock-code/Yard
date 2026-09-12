"use client"

import { useEffect, useState } from "react"
import { apiGet } from "@/lib/useApi"

type Ranked = {
  id: string
  ghostId: string
  avatarEmoji: string
  tier: string
  score: number
}

export default function LeaderboardPage() {
  const [ranked, setRanked] = useState<Ranked[]>([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    apiGet("/api/leaderboard")
      .then((data) => setRanked(data.leaderboard))
      .catch(console.error)
      .finally(() => setLoading(false))
  }, [])

  if (loading) return <p className="text-center text-white/40 mt-10">Loading leaderboard...</p>

  return (
    <main className="min-h-screen max-w-lg mx-auto pb-24 px-4">
      <h1 className="text-2xl font-black mt-4 mb-4">🏆 Leaderboard</h1>

      {ranked.length === 0 ? (
        <p className="text-white/40 text-center mt-8">No ranked ghosts yet.</p>
      ) : (
        <div className="space-y-2">
          {ranked.map((r, i) => (
            <div key={r.id} className="card p-3 flex items-center gap-3">
              <span className={`font-black w-6 text-center ${i < 3 ? "text-yellow-400" : "text-white/40"}`}>
                {i + 1}
              </span>
              <span className="text-xl">{r.avatarEmoji}</span>
              <div className="flex-1">
                <div className="flex items-center gap-2">
                  <span className="font-semibold text-sm">{r.ghostId}</span>
                  {r.tier === "PRIME" && <span className="badge badge-prime">Prime</span>}
                </div>
              </div>
              <span className="text-sm text-white/50 font-semibold">{r.score} pts</span>
            </div>
          ))}
        </div>
      )}
    </main>
  )
}