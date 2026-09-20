"use client"

import { useEffect, useState } from "react"
import Link from "next/link"
import { apiGet } from "@/lib/useApi"

type Ranked = { id: string; ghostId: string; avatarEmoji: string; tier: string; score: number }

export default function LeaderboardPage() {
  const [top, setTop] = useState<Ranked[]>([])
  const [myRank, setMyRank] = useState<number | null>(null)
  const [me, setMe] = useState<Ranked | null>(null)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    apiGet("/api/leaderboard")
      .then((data) => {
        setTop(data.leaderboard)
        setMyRank(data.myRank)
        setMe(data.me)
      })
      .catch(console.error)
      .finally(() => setLoading(false))
  }, [])

  if (loading) return <p className="text-center text-white/40 mt-10">Loading leaderboard...</p>

  const iAmInTop10 = myRank !== null && myRank <= 10

  return (
    <main className="min-h-screen max-w-lg mx-auto pb-28 px-4">
      <h1 className="text-2xl font-black mt-5 mb-1">🏆 Top 10</h1>
      <p className="text-white/40 text-sm mb-4">Only the best ghosts make the cut.</p>

      {top.length === 0 ? (
        <p className="text-white/40 text-center mt-8">No ranked ghosts yet.</p>
      ) : (
        <div className="space-y-2">
          {top.map((r, i) => (
            <div key={r.id} className={`card p-3 flex items-center gap-3 ${i < 3 ? "border-[#facc15]/30" : ""}`}>
              <span className={`font-black w-7 text-center ${i < 3 ? "text-[#facc15]" : "text-white/40"}`}>{i + 1}</span>
              <Link href={`/u/${encodeURIComponent(r.ghostId)}`} aria-label={`View ${r.ghostId}'s profile`} className="focus-visible:outline-[#baff39]">
                <span className="text-xl">{r.avatarEmoji}</span>
              </Link>
              <div className="flex-1">
                <div className="flex items-center gap-2">
                  <Link href={`/u/${encodeURIComponent(r.ghostId)}`} aria-label={`View ${r.ghostId}'s profile`} className="font-semibold text-sm focus-visible:outline-[#baff39]">
                    {r.ghostId}
                  </Link>
                  {r.tier === "PRIME" && <span className="badge badge-prime">Prime</span>}
                </div>
              </div>
              <span className="text-sm text-white/50 font-semibold">{r.score} pts</span>
            </div>
          ))}
        </div>
      )}

      {!iAmInTop10 && me && myRank && (
        <>
          <div className="h-px bg-white/10 my-4" />
          <p className="text-white/30 text-xs uppercase mb-2">Your position</p>
          <div className="card p-3 flex items-center gap-3 border-primary/30">
            <span className="font-black w-7 text-center text-primary">{myRank}</span>
            <Link href={`/u/${encodeURIComponent(me.ghostId)}`} aria-label={`View ${me.ghostId}'s profile`} className="focus-visible:outline-primary">
              <span className="text-xl">{me.avatarEmoji}</span>
            </Link>
            <div className="flex-1">
              <Link href={`/u/${encodeURIComponent(me.ghostId)}`} aria-label={`View ${me.ghostId}'s profile`} className="font-semibold text-sm focus-visible:outline-primary">
                {me.ghostId}
              </Link>
            </div>
            <span className="text-sm text-white/50 font-semibold">{me.score} pts</span>
          </div>
        </>
      )}
    </main>
  )
}