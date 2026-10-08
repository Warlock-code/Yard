// Flash rush hours — pure helpers, no imports (client + server safe).
// Ghana is UTC+0, so fixed UTC windows ARE local time. During a live window,
// post votes pay double credits to the author. Windows are deliberately few
// (3x 2h/week) so they feel like events, not inflation.

export type RushWindow = { day: number; startHour: number; endHour: number }
// Sun 0 … Sat 6 (getUTCDay)
const WINDOWS: RushWindow[] = [
  { day: 3, startHour: 19, endHour: 21 }, // wed 7–9pm
  { day: 5, startHour: 19, endHour: 21 }, // fri 7–9pm
  { day: 0, startHour: 17, endHour: 19 }, // sun 5–7pm
]

export const RUSH_MULTIPLIER = 2
const WEEK_MS = 7 * 86_400_000

function occurrence(base: Date, w: RushWindow, weekOffset: number): { start: number; end: number } {
  const day = new Date(Date.UTC(base.getUTCFullYear(), base.getUTCMonth(), base.getUTCDate()))
  const shift = ((w.day - day.getUTCDay() + 7) % 7) + weekOffset * 7
  const start = day.getTime() + shift * 86_400_000 + w.startHour * 3_600_000
  return { start, end: start + (w.endHour - w.startHour) * 3_600_000 }
}

export type RushStatus =
  | { live: true; endsAt: Date }
  | { live: false; nextStart: Date }

export function getRushStatus(now: Date = new Date()): RushStatus {
  const t = now.getTime()
  let nextStart: number | null = null
  for (const w of WINDOWS) {
    for (const weekOffset of [-1, 0, 1]) {
      const { start, end } = occurrence(now, w, weekOffset)
      if (t >= start && t < end) return { live: true, endsAt: new Date(end) }
      if (start > t && (nextStart === null || start < nextStart)) nextStart = start
    }
  }
  return { live: false, nextStart: new Date(nextStart ?? t + WEEK_MS) }
}

export function isRushLive(now: Date = new Date()): boolean {
  return getRushStatus(now).live
}
