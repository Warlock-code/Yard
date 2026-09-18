"use client"

import { useEffect, useState } from "react"
import { useRouter } from "next/navigation"
import Link from "next/link"
import { apiGet } from "@/lib/useApi"
import {
  EarningsLineChart,
  PostPerformanceBarChart,
  EarningsPieChart,
  FollowerGrowthChart,
  ActiveHoursChart,
  CampusBarChart,
  ComparisonBarChart,
  StatCard,
  DateRangePicker,
} from "@/lib/chart"
import { format } from "date-fns"

type EarningsData = {
  range: string
  period: string
  totalEarned: number
  bySource: Record<string, number>
  byDate: { date: string; posts: number; battles: number; leaderboard: number; total: number }[]
  breakdown: {
    posts: { postId: string; text: string; imageUrl: string | null; amount: number; createdAt: string }[]
    battles: { battleEntryId: string; promptText: string; text: string; amount: number; createdAt: string; votes: number }[]
    leaderboard: { amount: number; createdAt: string }[]
  }
}

type PostsData = {
  range: string
  summary: {
    totalPosts: number
    totalViews: number
    totalYeahs: number
    totalComments: number
    totalEarnings: number
    avgEngagementRate: number
  }
  posts: {
    id: string
    text: string
    imageUrl: string | null
    type: string
    views: number
    yeahs: number
    comments: number
    engagementRate: number
    earnings: number
    earningsPerView: number
    createdAt: string
    boosted: boolean
  }[]
}

type AudienceData = {
  range: string
  summary: {
    totalFollowers: number
    totalFollowing: number
    newFollowers: number
    netGrowth: number
    uniqueCampuses: number
  }
  followerGrowth: { week: string; count: number }[]
  topCampuses: { campus: string; count: number }[]
  topPrograms: { program: string; count: number }[]
  activeHours: { hour: number; count: number }[]
}

type Tab = "overview" | "earnings" | "posts" | "audience"

export default function AnalyticsPage() {
  const router = useRouter()
  const [tab, setTab] = useState<Tab>("overview")
  const [range, setRange] = useState("30d")
  const [loading, setLoading] = useState(true)
  const [earnings, setEarnings] = useState<EarningsData | null>(null)
  const [posts, setPosts] = useState<PostsData | null>(null)
  const [audience, setAudience] = useState<AudienceData | null>(null)

  async function fetchData() {
    setLoading(true)
    try {
      const [e, p, a] = await Promise.all([
        apiGet(`/api/analytics/earnings?range=${range}`),
        apiGet(`/api/analytics/posts?range=${range}`),
        apiGet(`/api/analytics/audience?range=${range}`),
      ])
      setEarnings(e)
      setPosts(p)
      setAudience(a)
    } catch (err) {
      console.error(err)
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    fetchData()
  }, [range])

  if (loading) {
    return (
      <main className="min-h-screen max-w-lg mx-auto pb-28 px-4">
        <div className="flex items-center gap-3 pt-5 pb-3">
          <button onClick={() => router.back()} className="text-white/60">←</button>
          <h1 className="text-xl font-bold">Analytics</h1>
        </div>
        <div className="flex items-center justify-center h-64">
          <div className="animate-spin rounded-full h-8 w-8 border-2 border-[#baff39] border-t-transparent"></div>
        </div>
      </main>
    )
  }

  const currentWeekEarnings = earnings?.breakdown.posts
    .filter((p) => new Date(p.createdAt) > new Date(Date.now() - 7 * 24 * 60 * 60 * 1000))
    .reduce((s, p) => s + p.amount, 0) || 0

  const lastWeekEarnings = earnings?.breakdown.posts
    .filter((p) => {
      const d = new Date(p.createdAt)
      const weekAgo = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000)
      const twoWeeksAgo = new Date(Date.now() - 14 * 24 * 60 * 60 * 1000)
      return d > twoWeeksAgo && d <= weekAgo
    })
    .reduce((s, p) => s + p.amount, 0) || 0

  const currentMonthEarnings = earnings?.totalEarned || 0
  const lastMonthEarnings = 0

  const earningsSources = Object.entries(earnings?.bySource || {})
    .map(([name, value]) => ({
      name: name.replace("_", " ").replace(/\b\w/g, (c) => c.toUpperCase()),
      value,
    }))
    .filter((s) => s.value > 0)

  const topPosts = posts?.posts.slice(0, 5) || []

  return (
    <main className="min-h-screen max-w-lg mx-auto pb-28 px-4">
      <div className="flex items-center gap-3 pt-5 pb-3">
        <button onClick={() => router.back()} className="text-white/60">←</button>
        <h1 className="text-xl font-bold">Analytics</h1>
      </div>

      <div className="flex gap-1 mb-4 overflow-x-auto pb-2">
        {(["overview", "earnings", "posts", "audience"] as Tab[]).map((t) => (
          <button
            key={t}
            onClick={() => setTab(t)}
            className={`whitespace-nowrap text-xs px-4 py-2 rounded-full border transition-colors ${
              tab === t
                ? "border-[#baff39] text-[#baff39] bg-[#baff39]/10"
                : "border-white/10 text-white/40"
            }`}
          >
            {t.charAt(0).toUpperCase() + t.slice(1)}
          </button>
        ))}
      </div>

      <div className="flex items-center justify-between mb-4">
        <DateRangePicker value={range} onChange={setRange} />
        {earnings && (
          <StatCard
            label="Total Earned"
            value={`₵${(earnings.totalEarned / 100).toFixed(2)}`}
            change={`${earnings.range}`}
          />
        )}
      </div>

      {tab === "overview" && (
        <div className="space-y-4">
          <div className="grid grid-cols-2 gap-3">
            <StatCard
              label="Total Earnings"
              value={earnings ? `₵${(earnings.totalEarned / 100).toFixed(2)}` : "₵0.00"}
              change={lastWeekEarnings ? `${currentWeekEarnings > lastWeekEarnings ? "+" : ""}${((currentWeekEarnings - lastWeekEarnings) / 100).toFixed(2)} vs last week` : undefined}
              trend={currentWeekEarnings >= lastWeekEarnings ? "up" : "down"}
            />
            <StatCard
              label="Total Views"
              value={posts?.summary.totalViews.toLocaleString() || "0"}
              change={posts?.summary.totalPosts ? `${posts.summary.totalPosts} posts` : undefined}
            />
            <StatCard
              label="Followers"
              value={audience?.summary.totalFollowers.toLocaleString() || "0"}
              change={audience?.summary.newFollowers ? `+${audience.summary.newFollowers} this period` : undefined}
              trend={audience?.summary.newFollowers && audience.summary.newFollowers > 0 ? "up" : "neutral"}
            />
            <StatCard
              label="Engagement Rate"
              value={`${posts?.summary.avgEngagementRate.toFixed(1) || "0"}%`}
            />
          </div>

          <div className="bg-white/[0.03] border border-white/[0.06] rounded-xl p-4">
            <h3 className="text-sm font-semibold mb-4">Earnings Over Time</h3>
            <EarningsLineChart data={earnings?.byDate || []} />
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div className="bg-white/[0.03] border border-white/[0.06] rounded-xl p-4">
              <h3 className="text-sm font-semibold mb-3">Earnings Sources</h3>
              <EarningsPieChart data={earningsSources} />
            </div>
            <div className="bg-white/[0.03] border border-white/[0.06] rounded-xl p-4">
              <h3 className="text-sm font-semibold mb-3">Top Posts by Earnings</h3>
              <PostPerformanceBarChart data={posts?.posts || []} />
            </div>
          </div>

          <div className="bg-white/[0.03] border border-white/[0.06] rounded-xl p-4">
            <h3 className="text-sm font-semibold mb-3">This Week vs Last Week</h3>
            <ComparisonBarChart
              current={[currentWeekEarnings]}
              previous={[lastWeekEarnings]}
              labels={["Earnings"]}
            />
          </div>

          <div className="bg-white/[0.03] border border-white/[0.06] rounded-xl p-4">
            <h3 className="text-sm font-semibold mb-3">Best Performing Posts</h3>
            {topPosts.length === 0 ? (
              <p className="text-white/40 text-center py-4">No posts yet</p>
            ) : (
              topPosts.map((post) => (
                <div key={post.id} className="border-b border-white/[0.06] py-3 last:border-0">
                  <p className="text-sm text-white/90 mb-1">{post.text || (post.imageUrl ? "📷 Image post" : "Post")}</p>
                  <div className="flex gap-4 text-xs text-white/40">
                    <span>👁 {post.views.toLocaleString()}</span>
                    <span>🔥 {post.yeahs}</span>
                    <span>💬 {post.comments}</span>
                    <span className="text-[#baff39]">₵${(post.earnings / 100).toFixed(2)}</span>
                    <span>{post.engagementRate.toFixed(1)}%</span>
                  </div>
                </div>
              ))
            )}
          </div>
        </div>
      )}

      {tab === "earnings" && earnings && (
        <div className="space-y-4">
          <div className="bg-white/[0.03] border border-white/[0.06] rounded-xl p-4">
            <h3 className="text-sm font-semibold mb-4">Earnings Breakdown by Source</h3>
            <EarningsPieChart data={earningsSources} />
            <div className="grid grid-cols-3 gap-2 mt-4">
              {earningsSources.map((s) => (
                <div key={s.name} className="bg-white/[0.02] rounded-lg p-3 text-center">
                  <p className="text-xs text-white/40">{s.name}</p>
                  <p className="text-lg font-bold text-white">₵${(s.value / 100).toFixed(2)}</p>
                  <p className="text-xs text-white/30">{((s.value / earnings.totalEarned) * 100).toFixed(1)}%</p>
                </div>
              ))}
            </div>
          </div>

          <div className="bg-white/[0.03] border border-white/[0.06] rounded-xl p-4">
            <h3 className="text-sm font-semibold mb-4">Earnings Over Time</h3>
            <EarningsLineChart data={earnings.byDate} />
          </div>

          <div className="bg-white/[0.03] border border-white/[0.06] rounded-xl p-4">
            <h3 className="text-sm font-semibold mb-4">Post Earnings</h3>
            {earnings.breakdown.posts.length === 0 ? (
              <p className="text-white/40 text-center py-4">No post earnings</p>
            ) : (
              earnings.breakdown.posts.map((p) => (
                <div key={p.postId} className="border-b border-white/[0.06] py-3 last:border-0 flex items-center justify-between">
                  <div className="flex-1 mr-3">
                    <p className="text-sm text-white/90">{p.text || (p.imageUrl ? "📷 Image post" : "Post")}</p>
                    <p className="text-xs text-white/40">{format(new Date(p.createdAt), "MMM d, yyyy")}</p>
                  </div>
                  <span className="text-[#baff39] font-semibold">₵${(p.amount / 100).toFixed(2)}</span>
                </div>
              ))
            )}
          </div>

          <div className="bg-white/[0.03] border border-white/[0.06] rounded-xl p-4">
            <h3 className="text-sm font-semibold mb-4">Battle Earnings</h3>
            {earnings.breakdown.battles.length === 0 ? (
              <p className="text-white/40 text-center py-4">No battle earnings</p>
            ) : (
              earnings.breakdown.battles.map((b) => (
                <div key={b.battleEntryId} className="border-b border-white/[0.06] py-3 last:border-0 flex items-center justify-between">
                  <div className="flex-1 mr-3">
                    <p className="text-sm text-white/90">{b.promptText || "Battle"}</p>
                    <p className="text-xs text-white/40">{b.text ? `${b.text.slice(0, 50)}...` : "Entry"}</p>
                  </div>
                  <div className="text-right">
                    <span className="text-[#baff39] font-semibold">₵${(b.amount / 100).toFixed(2)}</span>
                    <p className="text-xs text-white/40">{b.votes} votes</p>
                  </div>
                </div>
              ))
            )}
          </div>

          <div className="bg-white/[0.03] border border-white/[0.06] rounded-xl p-4">
            <h3 className="text-sm font-semibold mb-4">Leaderboard Bonuses</h3>
            {earnings.breakdown.leaderboard.length === 0 ? (
              <p className="text-white/40 text-center py-4">No leaderboard bonuses</p>
            ) : (
              earnings.breakdown.leaderboard.map((l, i) => (
                <div key={i} className="border-b border-white/[0.06] py-3 last:border-0 flex items-center justify-between">
                  <p className="text-sm text-white/90">Leaderboard Bonus</p>
                  <div className="text-right">
                    <span className="text-[#baff39] font-semibold">₵${(l.amount / 100).toFixed(2)}</span>
                    <p className="text-xs text-white/40">{format(new Date(l.createdAt), "MMM d, yyyy")}</p>
                  </div>
                </div>
              ))
            )}
          </div>
        </div>
      )}

      {tab === "posts" && posts && (
        <div className="space-y-4">
          <div className="grid grid-cols-2 gap-3">
            <StatCard label="Total Posts" value={posts.summary.totalPosts.toString()} />
            <StatCard label="Total Views" value={posts.summary.totalViews.toLocaleString()} />
            <StatCard label="Total Earnings" value={`₵${(posts.summary.totalEarnings / 100).toFixed(2)}`} />
            <StatCard label="Avg Engagement" value={`${posts.summary.avgEngagementRate.toFixed(1)}%`} />
          </div>

          <div className="bg-white/[0.03] border border-white/[0.06] rounded-xl p-4">
            <h3 className="text-sm font-semibold mb-4">Post Performance</h3>
            <PostPerformanceBarChart data={posts.posts} />
          </div>

          <div className="bg-white/[0.03] border border-white/[0.06] rounded-xl p-4">
            <h3 className="text-sm font-semibold mb-4">All Posts</h3>
            {posts.posts.length === 0 ? (
              <p className="text-white/40 text-center py-4">No posts in this period</p>
            ) : (
              posts.posts.map((post) => (
                <div key={post.id} className="border-b border-white/[0.06] py-3 last:border-0">
                  <div className="flex items-start justify-between gap-3">
                    <div className="flex-1 min-w-0">
                      <p className="text-sm text-white/90 mb-1">{post.text || (post.imageUrl ? "📷 Image post" : "Post")}</p>
                      <div className="flex gap-4 text-xs text-white/40 flex-wrap">
                        <span>👁 {post.views.toLocaleString()}</span>
                        <span>🔥 {post.yeahs}</span>
                        <span>💬 {post.comments}</span>
                        <span>{post.engagementRate.toFixed(1)}% engagement</span>
                        {post.boosted && <span className="text-yellow-400">⚡ Boosted</span>}
                      </div>
                    </div>
                    <div className="text-right whitespace-nowrap">
                      <span className="text-[#baff39] font-semibold">₵${(post.earnings / 100).toFixed(2)}</span>
                      <p className="text-xs text-white/40">₵${post.earningsPerView.toFixed(4)}/view</p>
                    </div>
                  </div>
                </div>
              ))
            )}
          </div>
        </div>
      )}

      {tab === "audience" && audience && (
        <div className="space-y-4">
          <div className="grid grid-cols-2 gap-3">
            <StatCard label="Total Followers" value={audience.summary.totalFollowers.toLocaleString()} />
            <StatCard label="Following" value={audience.summary.totalFollowing.toLocaleString()} />
            <StatCard
              label="New Followers"
              value={audience.summary.newFollowers.toString()}
              change={audience.summary.netGrowth > 0 ? `+${audience.summary.netGrowth} net` : undefined}
              trend={audience.summary.netGrowth > 0 ? "up" : "down"}
            />
            <StatCard label="Campuses" value={audience.summary.uniqueCampuses.toString()} />
          </div>

          <div className="bg-white/[0.03] border border-white/[0.06] rounded-xl p-4">
            <h3 className="text-sm font-semibold mb-4">Follower Growth</h3>
            <FollowerGrowthChart data={audience.followerGrowth} />
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div className="bg-white/[0.03] border border-white/[0.06] rounded-xl p-4">
              <h3 className="text-sm font-semibold mb-3">Top Campuses</h3>
              <CampusBarChart data={audience.topCampuses} />
            </div>
            <div className="bg-white/[0.03] border border-white/[0.06] rounded-xl p-4">
              <h3 className="text-sm font-semibold mb-3">Active Hours</h3>
              <ActiveHoursChart data={audience.activeHours} />
            </div>
          </div>

          <div className="bg-white/[0.03] border border-white/[0.06] rounded-xl p-4">
            <h3 className="text-sm font-semibold mb-4">Top Programs</h3>
            {audience.topPrograms.length === 0 ? (
              <p className="text-white/40 text-center py-4">No program data</p>
            ) : (
              audience.topPrograms.map((p, i) => (
                <div key={i} className="border-b border-white/[0.06] py-2 last:border-0 flex items-center justify-between">
                  <p className="text-sm text-white/90">{p.program}</p>
                  <span className="text-white/60">{p.count} followers</span>
                </div>
              ))
            )}
          </div>
        </div>
      )}
    </main>
  )
}