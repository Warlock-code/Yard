"use client"

import { useEffect, useState } from "react"
import Link from "next/link"
import { apiGet } from "@/lib/useApi"
import ChampionTrophies from "@/app/components/ChampionTrophies"

type Ranked = { id: string; ghostId: string; avatarEmoji: string; tier: string; score: number; championTrophies?: number }
type WarCampus = { campus: string; posts: number; yeahs: number; comments: number; score: number }

export default function LeaderboardPage() {
  const [tab, setTab] = useState<"top" | "war">("top")
  const [top, setTop] = useState<Ranked[]>([])
  const [myRank, setMyRank] = useState<number | null>(null)
  const [me, setMe] = useState<Ranked | null>(null)
  const [loading, setLoading] = useState(true)
  const [war, setWar] = useState<WarCampus[]>([])
  const [myCampus, setMyCampus] = useState<string | null>(null)
  const [warLoading, setWarLoading] = useState(false)

  useEffect(() => {
    apiGet<{ leaderboard: Ranked[]; myRank: number | null; me: Ranked | null }>("/api/leaderboard")
      .then((data) => {
        setTop(data.leaderboard)
        setMyRank(data.myRank)
        setMe(data.me)
      })
      .catch(console.error)
      .finally(() => setLoading(false))
  }, [])

  useEffect(() => {
    if (tab !== "war" || war.length > 0) return
    setWarLoading(true)
    apiGet<{ campuses: WarCampus[]; myCampus: string }>("/api/leaderboard/war")
      .then((data) => {
        setWar(data.campuses || [])
        setMyCampus(data.myCampus)
      })
      .catch(console.error)
      .finally(() => setWarLoading(false))
  }, [tab, war.length])

  if (loading) return <p className="text-center text-white/40 mt-10">loading leaderboard...</p>

  const iAmInTop10 = myRank !== null && myRank <= 10

  return (
    <main className="min-h-screen max-w-lg mx-auto pb-28 px-4">
      <h1 className="text-2xl font-black mt-5 mb-1">🏆 boards</h1>
      <p className="text-white/40 text-sm mb-4">only the best ghosts make the cut.</p>

      <div className="flex gap-1.5 mb-4" role="tablist" aria-label="leaderboard tabs">
        {(["top", "war"] as const).map((t) => (
          <button
            key={t}
            role="tab"
            aria-selected={tab === t}
            onClick={() => setTab(t)}
            className={`flex-1 py-2 px-3 rounded-xl text-sm font-bold transition-colors ${
              tab === t ? "bg-[#facc15]/15 text-[#facc15]" : "text-white/50 hover:text-white/80 hover:bg-white/5"
            }`}
          >
            {t === "top" ? "👻 top ghosts" : "⚔️ campus war"}
          </button>
        ))}
      </div>

      {tab === "war" ? (
        <WarBoard war={war} myCampus={myCampus} loading={warLoading} />
      ) : (
      <>
      {top.length === 0 ? (
        <p className="text-white/40 text-center mt-8">no ranked ghosts yet.</p>
      ) : (
        <div className="space-y-2">
          {top.map((r, i) => (
            <div key={r.id} className={`card p-3 flex items-center gap-3 ${i < 3 ? "border-[#facc15]/30" : ""}`}>
              <span className={`font-black w-7 text-center ${i < 3 ? "text-[#facc15]" : "text-white/40"}`}>{i + 1}</span>
              <Link href={`/u/${encodeURIComponent(r.ghostId)}`} aria-label={`view ${r.ghostId}'s profile`} className="focus-visible:outline-[#baff39]">
                <span className="text-xl">{r.avatarEmoji}</span>
              </Link>
              <div className="flex-1">
                <div className="flex items-center gap-2">
                  <Link href={`/u/${encodeURIComponent(r.ghostId)}`} aria-label={`view ${r.ghostId}'s profile`} className="font-semibold text-sm focus-visible:outline-[#baff39]">
                    {r.ghostId}
                  </Link>
                  {r.tier === "PLUS" && <span className="badge badge-plus">✓ plus</span>}
                  {r.tier === "PRIME" && <span className="badge badge-prime">👑 prime</span>}
                  <ChampionTrophies trophies={r.championTrophies} className="text-[10px] leading-none" />
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
          <p className="text-white/30 text-xs uppercase mb-2">your position</p>
          <div className="card p-3 flex items-center gap-3 border-primary/30">
            <span className="font-black w-7 text-center text-primary">{myRank}</span>
            <Link href={`/u/${encodeURIComponent(me.ghostId)}`} aria-label={`view ${me.ghostId}'s profile`} className="focus-visible:outline-primary">
              <span className="text-xl">{me.avatarEmoji}</span>
            </Link>
            <div className="flex-1">
              <div className="flex items-center gap-2">
                <Link href={`/u/${encodeURIComponent(me.ghostId)}`} aria-label={`view ${me.ghostId}'s profile`} className="font-semibold text-sm focus-visible:outline-primary">
                  {me.ghostId}
                </Link>
                {me.tier === "PLUS" && <span className="badge badge-plus">✓ plus</span>}
                {me.tier === "PRIME" && <span className="badge badge-prime">👑 prime</span>}
                <ChampionTrophies trophies={me.championTrophies} className="text-[10px] leading-none" />
              </div>
            </div>
            <span className="text-sm text-white/50 font-semibold">{me.score} pts</span>
          </div>
        </>
      )}
      </>
      )}
    </main>
  )
}

function WarBoard({ war, myCampus, loading }: { war: WarCampus[]; myCampus: string | null; loading: boolean }) {
  if (loading) return <p className="text-center text-white/40 mt-8">counting the heat...</p>
  if (war.length === 0) {
    return (
      <div className="text-center mt-10 px-8">
        <p className="text-3xl mb-3">⚔️</p>
        <p className="text-white/50 text-sm">no shots fired yet this week. post something and start the war.</p>
      </div>
    )
  }
  const leader = war[0]
  const mine = war.find((w) => w.campus === myCampus)
  const gap = mine && mine.campus !== leader.campus ? leader.score - mine.score : 0
  return (
    <div className="space-y-2">
      <div className="card p-3 flex items-center justify-between border-[#facc15]/25">
        <span className="text-xs font-bold text-white/60">this week&apos;s heat • resets monday</span>
        {gap > 0 && mine ? (
          <span className="text-xs font-bold text-[#facc15]">{mine.campus} needs {gap} pts 🔥</span>
        ) : (
          <span className="text-xs font-bold text-[#facc15]">{myCampus} leads ⚔️</span>
        )}
      </div>
      {war.map((w, i) => {
        const isMine = w.campus === myCampus
        const pct = leader.score > 0 ? Math.max(4, Math.round((w.score / leader.score) * 100)) : 4
        return (
          <div key={w.campus} className={`card p-3 ${isMine ? "border-primary/40" : ""} ${i === 0 ? "border-[#facc15]/40" : ""}`}>
            <div className="flex items-center gap-3 mb-2">
              <span className={`font-black w-7 text-center ${i === 0 ? "text-[#facc15]" : "text-white/40"}`}>{i + 1}</span>
              <div className="flex-1 min-w-0">
                <p className="font-bold text-sm truncate">
                  {w.campus} {isMine && <span className="text-[10px] text-primary font-black">• you</span>}
                </p>
                <p className="text-[11px] text-white/40">{w.posts} posts • {w.yeahs} 🔥 • {w.comments} 💬</p>
              </div>
              <span className="text-sm font-black text-white/80">{w.score}</span>
            </div>
            <div className="h-1.5 rounded-full bg-white/[0.07] overflow-hidden">
              <div
                className={`h-full rounded-full ${i === 0 ? "bg-[#facc15]" : isMine ? "bg-primary" : "bg-white/25"}`}
                style={{ width: `${pct}%` }}
              />
            </div>
          </div>
        )
      })}
      <p className="text-center text-white/30 text-xs pt-2">post + get yeahed to push your campus up.</p>
    </div>
  )
}