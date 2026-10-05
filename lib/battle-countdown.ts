// Pure helpers for battle notifications (no imports — safe to unit-test).
// Used by the admin create route (instant alert) and the daily cron (countdowns).

const HOUR_MS = 60 * 60 * 1000
const MAX_TEXT = 80

function shortText(text: string): string {
  const t = text.trim().replace(/\s+/g, " ")
  return t.length > MAX_TEXT ? `${t.slice(0, MAX_TEXT - 1)}…` : t
}

function dayLabel(diffMs: number): string {
  const hours = diffMs / HOUR_MS
  if (hours < 24) return "today"
  if (hours < 48) return "tomorrow"
  return `in ${Math.floor(hours / 24)} days`
}

export type BattleTiming = {
  text: string
  status: string
  startsAt: Date
  endsAt: Date
  now?: Date
}

/** Daily countdown copy. Null when there's nothing to count down to. */
export function battleCountdownText(input: BattleTiming): { title: string; body: string } | null {
  const now = input.now ?? new Date()
  const name = `"${shortText(input.text)}"`

  if (input.status === "UPCOMING" && input.startsAt.getTime() > now.getTime()) {
    return {
      title: "⚔️ battle countdown",
      body: `${name} starts ${dayLabel(input.startsAt.getTime() - now.getTime())}.`,
    }
  }

  if (input.status === "ACTIVE" && input.endsAt.getTime() > now.getTime()) {
    const label = dayLabel(input.endsAt.getTime() - now.getTime())
    return {
      title: "⚔️ battle ending soon",
      body:
        label === "today"
          ? `${name} ends today — last chance to enter.`
          : `${name} ends ${label}.`,
    }
  }

  return null
}

/** Instant "admin just posted a battle" copy. */
export function newBattleText(input: BattleTiming): { title: string; body: string } {
  const name = `"${shortText(input.text)}"`
  if (input.status === "ACTIVE") {
    return { title: "⚔️ new battle just dropped", body: `${name} is live — enter your take.` }
  }
  const countdown = battleCountdownText(input)
  if (countdown) {
    return { title: "⚔️ new battle announced", body: countdown.body }
  }
  return { title: "⚔️ new battle just dropped", body: `${name} — check it out.` }
}
