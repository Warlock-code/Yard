// Custom reaction catalog (shared). Lives here — not in the route file —
// because Next.js route modules may only export HTTP handlers.
export const REACTION_EMOJI = ["🔥", "😂", "💀", "❤️", "🐐", "👻", "⚔️", "🏆", "💧", "🤡"] as const

export type ReactionEmoji = (typeof REACTION_EMOJI)[number]
