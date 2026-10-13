// Emitter-vs-sink inflation guardrail (shared).
// Credits are virtual with no cash value, but runaway emission still
// devalues every price in the shop. Emitted = Σ positive ledger amounts
// (purchases, earns, grants, refunds); spent = Σ |negative| amounts.
// MISSED_EARNING shadows never touch balances, so they're excluded.
// Snapshots persist as AnalyticsEvents (type emit_sink_snapshot, one per
// day) so the 3-day alert streak survives restarts without a new table.
import { prisma } from "@/lib/prisma"

export const EMIT_SINK_WARN = 1.2
export const EMIT_SINK_ALERT = 1.5
export const EMIT_SINK_ALERT_DAYS = 3

export type EmitSink = {
  emitted: number
  spent: number
  ratio: number
}

export async function computeEmitSinkWindow(from: Date, to: Date): Promise<EmitSink> {
  try {
    const rows = await prisma.creditTransaction.groupBy({
      by: ["type"],
      where: { createdAt: { gte: from, lt: to }, NOT: { type: "MISSED_EARNING" } },
      _sum: { amount: true },
    })
    let emitted = 0
    let spent = 0
    for (const r of rows) {
      const sum = r._sum.amount ?? 0
      if (sum > 0) emitted += sum
      else spent += Math.abs(sum)
    }
    return { emitted, spent, ratio: spent > 0 ? emitted / spent : emitted > 0 ? Infinity : 0 }
  } catch {
    return { emitted: 0, spent: 0, ratio: 0 }
  }
}

export async function computeEmitSink(since: Date): Promise<EmitSink> {
  return computeEmitSinkWindow(since, new Date())
}

function dayKey(d: Date): string {
  return d.toISOString().slice(0, 10)
}

// Idempotent snapshot of YESTERDAY's full day (complete 24h window, so
// day-over-day ratios are comparable). Reruns same-day are no-ops.
export async function snapshotEmitSink(now: Date = new Date()): Promise<EmitSink> {
  const todayStart = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate()))
  const yesterdayStart = new Date(todayStart.getTime() - 86_400_000)
  const stats = await computeEmitSinkWindow(yesterdayStart, todayStart)
  try {
    const key = dayKey(yesterdayStart)
    const existing = await prisma.analyticsEvent.findFirst({
      where: { userId: null, type: "emit_sink_snapshot" },
      orderBy: { createdAt: "desc" },
      select: { id: true, metadata: true, createdAt: true },
    })
    const meta = existing?.metadata as { date?: unknown } | null
    if (!existing || meta?.date !== key) {
      await prisma.analyticsEvent.create({
        data: {
          userId: null,
          type: "emit_sink_snapshot",
          metadata: { date: key, emitted: stats.emitted, spent: stats.spent, ratio: stats.ratio },
        },
      }).catch(() => null)
    }
  } catch {
    // snapshot failures never break the caller
  }
  return stats
}

// True when the last `days` daily snapshots ALL exceed `threshold`.
export async function emitSinkStreak(
  threshold: number = EMIT_SINK_ALERT,
  days: number = EMIT_SINK_ALERT_DAYS
): Promise<{ alert: boolean; snapshots: { date: string; ratio: number }[] }> {
  try {
    const rows = await prisma.analyticsEvent.findMany({
      where: { userId: null, type: "emit_sink_snapshot" },
      orderBy: { createdAt: "desc" },
      take: days,
      select: { metadata: true },
    })
    const snapshots = rows
      .map((r) => {
        const m = r.metadata as { date?: unknown; ratio?: unknown } | null
        return {
          date: typeof m?.date === "string" ? m.date : "",
          ratio: typeof m?.ratio === "number" ? m.ratio : 0,
        }
      })
      .filter((s) => s.date)
    if (snapshots.length < days) return { alert: false, snapshots }
    return { alert: snapshots.every((s) => s.ratio > threshold), snapshots }
  } catch {
    return { alert: false, snapshots: [] }
  }
}
