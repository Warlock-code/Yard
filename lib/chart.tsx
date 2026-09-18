"use client"

import {
  LineChart,
  Line,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  BarChart,
  Bar,
  PieChart,
  Pie,
  Cell,
  Legend,
} from "recharts"
import { format } from "date-fns"

const COLORS = ["#baff39", "#00d4ff", "#ff6b6b", "#ffd93d", "#6bcb77", "#4d96ff", "#ff9f43", "#ee5a6f"]

interface EarningsOverTimeData {
  date: string
  posts: number
  battles: number
  leaderboard: number
  total: number
}

interface PostPerformanceData {
  id: string
  text: string
  views: number
  yeahs: number
  earnings: number
}

interface EarningsSourceData {
  name: string
  value: number
}

interface AudienceGrowthData {
  week: string
  count: number
}

interface ActiveHoursData {
  hour: number
  count: number
}

const safeNumberFormatter = (value: unknown) => {
  const num = typeof value === "number" ? value : 0
  return [`₵${(num / 100).toFixed(2)}`, ""] as [string, string]
}

const safeDateLabel = (value: unknown) => {
  try {
    return format(new Date(String(value)), "MMM d, yyyy")
  } catch {
    return String(value ?? "")
  }
}

export function EarningsLineChart({ data }: { data: EarningsOverTimeData[] }) {
  if (!data.length) return <div className="h-64 flex items-center justify-center text-white/30">No earnings data</div>

  return (
    <div className="h-64">
      <ResponsiveContainer width="100%" height="100%">
        <LineChart data={data} margin={{ top: 10, right: 30, left: 0, bottom: 0 }}>
          <CartesianGrid strokeDasharray="3 3" stroke="#ffffff10" vertical={false} />
          <XAxis
            dataKey="date"
            tickFormatter={(value) => format(new Date(String(value)), "MMM d")}
            stroke="#ffffff40"
            fontSize={11}
            tick={{ fill: "#ffffff60" }}
            tickLine={false}
            axisLine={{ stroke: "#ffffff20" }}
          />
          <YAxis
            stroke="#ffffff40"
            fontSize={11}
            tick={{ fill: "#ffffff60" }}
            tickFormatter={(value) => `₵${(value / 100).toFixed(0)}`}
            tickLine={false}
            axisLine={false}
          />
          <Tooltip
            contentStyle={{ backgroundColor: "#1a1a1a", border: "1px solid #ffffff20", borderRadius: 8 }}
            labelFormatter={safeDateLabel}
            formatter={safeNumberFormatter}
          />
          <Legend wrapperStyle={{ paddingTop: 10 }} />
          <Line type="monotone" dataKey="posts" stroke={COLORS[0]} strokeWidth={2} dot={false} name="Posts" animationDuration={300} />
          <Line type="monotone" dataKey="battles" stroke={COLORS[1]} strokeWidth={2} dot={false} name="Battles" animationDuration={300} />
          <Line type="monotone" dataKey="leaderboard" stroke={COLORS[2]} strokeWidth={2} dot={false} name="Leaderboard" animationDuration={300} />
          <Line type="monotone" dataKey="total" stroke={COLORS[3]} strokeWidth={2} dot={false} name="Total" animationDuration={300} />
        </LineChart>
      </ResponsiveContainer>
    </div>
  )
}

export function PostPerformanceBarChart({ data }: { data: PostPerformanceData[] }) {
  if (!data.length) return <div className="h-64 flex items-center justify-center text-white/30">No post data</div>

  const topPosts = data.slice(0, 10).reverse()

  return (
    <div className="h-64">
      <ResponsiveContainer width="100%" height="100%">
        <BarChart data={topPosts} margin={{ top: 10, right: 30, left: 10, bottom: 0 }} layout="vertical">
          <CartesianGrid strokeDasharray="3 3" stroke="#ffffff10" horizontal={false} />
          <XAxis
            type="number"
            stroke="#ffffff40"
            fontSize={11}
            tick={{ fill: "#ffffff60" }}
            tickFormatter={(v) => `₵${(v / 100).toFixed(0)}`}
            tickLine={false}
            axisLine={{ stroke: "#ffffff20" }}
          />
          <YAxis
            type="category"
            dataKey="text"
            width={120}
            stroke="#ffffff40"
            fontSize={11}
            tick={{ fill: "#ffffff60" }}
            tickLine={false}
            axisLine={false}
          />
          <Tooltip
            contentStyle={{ backgroundColor: "#1a1a1a", border: "1px solid #ffffff20", borderRadius: 8 }}
            formatter={safeNumberFormatter}
          />
          <Bar dataKey="earnings" fill={COLORS[0]} radius={[0, 4, 4, 0]} maxBarSize={30} />
        </BarChart>
      </ResponsiveContainer>
    </div>
  )
}

export function EarningsPieChart({ data }: { data: EarningsSourceData[] }) {
  if (!data.length) return <div className="h-48 flex items-center justify-center text-white/30">No earnings data</div>

  return (
    <div className="h-48">
      <ResponsiveContainer width="100%" height="100%">
        <PieChart>
          <Pie
            data={data}
            cx="50%"
            cy="50%"
            innerRadius={50}
            outerRadius={80}
            paddingAngle={2}
            dataKey="value"
            nameKey="name"
            label={({ name, percent }) => `${name} ${((percent ?? 0) * 100).toFixed(0)}%`}
            labelLine={false}
            stroke="#0a0a0a"
            strokeWidth={2}
          >
            {data.map((_, index) => (
              <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} />
            ))}
          </Pie>
          <Tooltip
            contentStyle={{ backgroundColor: "#1a1a1a", border: "1px solid #ffffff20", borderRadius: 8 }}
            formatter={safeNumberFormatter}
          />
        </PieChart>
      </ResponsiveContainer>
    </div>
  )
}

export function FollowerGrowthChart({ data }: { data: AudienceGrowthData[] }) {
  if (!data.length) return <div className="h-48 flex items-center justify-center text-white/30">No growth data</div>

  return (
    <div className="h-48">
      <ResponsiveContainer width="100%" height="100%">
        <LineChart data={data} margin={{ top: 10, right: 30, left: 0, bottom: 0 }}>
          <CartesianGrid strokeDasharray="3 3" stroke="#ffffff10" vertical={false} />
          <XAxis
            dataKey="week"
            tickFormatter={(value) => format(new Date(String(value)), "MMM d")}
            stroke="#ffffff40"
            fontSize={11}
            tick={{ fill: "#ffffff60" }}
            tickLine={false}
            axisLine={{ stroke: "#ffffff20" }}
          />
          <YAxis
            stroke="#ffffff40"
            fontSize={11}
            tick={{ fill: "#ffffff60" }}
            tickLine={false}
            axisLine={false}
          />
          <Tooltip
            contentStyle={{ backgroundColor: "#1a1a1a", border: "1px solid #ffffff20", borderRadius: 8 }}
            labelFormatter={safeDateLabel}
            formatter={(value: unknown) => {
              const num = typeof value === "number" ? value : 0
              return [num.toString(), ""] as [string, string]
            }}
          />
          <Line type="monotone" dataKey="count" stroke={COLORS[0]} strokeWidth={2} dot={{ r: 4, fill: COLORS[0] }} name="New Followers" animationDuration={300} />
        </LineChart>
      </ResponsiveContainer>
    </div>
  )
}

export function ActiveHoursChart({ data }: { data: ActiveHoursData[] }) {
  if (!data.length) return <div className="h-48 flex items-center justify-center text-white/30">No activity data</div>

  return (
    <div className="h-48">
      <ResponsiveContainer width="100%" height="100%">
        <BarChart data={data} margin={{ top: 10, right: 30, left: 0, bottom: 0 }}>
          <CartesianGrid strokeDasharray="3 3" stroke="#ffffff10" vertical={false} />
          <XAxis dataKey="hour" stroke="#ffffff40" fontSize={11} tick={{ fill: "#ffffff60" }} tickLine={false} axisLine={{ stroke: "#ffffff20" }} />
          <YAxis stroke="#ffffff40" fontSize={11} tick={{ fill: "#ffffff60" }} tickLine={false} axisLine={false} />
          <Tooltip contentStyle={{ backgroundColor: "#1a1a1a", border: "1px solid #ffffff20", borderRadius: 8 }} />
          <Bar dataKey="count" fill={COLORS[4]} radius={[0, 4, 4, 0]} maxBarSize={25} />
        </BarChart>
      </ResponsiveContainer>
    </div>
  )
}

export function ComparisonBarChart({
  current,
  previous,
  labels,
}: {
  current: number[]
  previous: number[]
  labels: string[]
}) {
  const data = labels.map((label, i) => ({
    label,
    current: current[i] || 0,
    previous: previous[i] || 0,
  }))

  return (
    <div className="h-48">
      <ResponsiveContainer width="100%" height="100%">
        <BarChart data={data} margin={{ top: 10, right: 30, left: 0, bottom: 0 }}>
          <CartesianGrid strokeDasharray="3 3" stroke="#ffffff10" vertical={false} />
          <XAxis dataKey="label" stroke="#ffffff40" fontSize={11} tick={{ fill: "#ffffff60" }} tickLine={false} axisLine={{ stroke: "#ffffff20" }} />
          <YAxis
            stroke="#ffffff40"
            fontSize={11}
            tick={{ fill: "#ffffff60" }}
            tickFormatter={(v) => `₵${(v / 100).toFixed(0)}`}
            tickLine={false}
            axisLine={false}
          />
          <Tooltip
            contentStyle={{ backgroundColor: "#1a1a1a", border: "1px solid #ffffff20", borderRadius: 8 }}
            formatter={safeNumberFormatter}
          />
          <Legend wrapperStyle={{ paddingTop: 10 }} />
          <Bar dataKey="current" fill={COLORS[0]} name="This Period" radius={[4, 4, 0, 0]} maxBarSize={30} />
          <Bar dataKey="previous" fill={COLORS[1]} name="Last Period" radius={[4, 4, 0, 0]} maxBarSize={30} />
        </BarChart>
      </ResponsiveContainer>
    </div>
  )
}

export function StatCard({
  label,
  value,
  change,
  trend,
}: {
  label: string
  value: string
  change?: string
  trend?: "up" | "down" | "neutral"
}) {
  return (
    <div className="bg-white/[0.03] border border-white/[0.06] rounded-xl p-4">
      <p className="text-xs text-white/40 uppercase tracking-wide mb-1">{label}</p>
      <p className="text-2xl font-bold text-white">{value}</p>
      {change && (
        <p
          className={`text-xs mt-1 flex items-center gap-1 ${
            trend === "up" ? "text-green-400" : trend === "down" ? "text-red-400" : "text-white/40"
          }`}
        >
          {trend === "up" ? "↑" : trend === "down" ? "↓" : "→"} {change}
        </p>
      )}
    </div>
  )
}

export function DateRangePicker({ value, onChange }: { value: string; onChange: (v: string) => void }) {
  const ranges = [
    { value: "7d", label: "Last 7 days" },
    { value: "30d", label: "Last 30 days" },
    { value: "90d", label: "Last 90 days" },
    { value: "all", label: "All time" },
  ]

  return (
    <select
      value={value}
      onChange={(e) => onChange(e.target.value)}
      className="bg-white/[0.05] border border-white/[0.1] rounded-lg px-3 py-2 text-sm text-white focus:outline-none focus:border-[#baff39] appearance-none"
    >
      {ranges.map((r) => (
        <option key={r.value} value={r.value}>
          {r.label}
        </option>
      ))}
    </select>
  )
}