type Props = {
  trophies?: number | null
  className?: string
}

// Reigning campus battle champion badge. Repeats 🏆 per win
// (3 wins = 🏆🏆🏆). Capped at 10 so huge counts can't break layout.
export default function ChampionTrophies({ trophies, className }: Props) {
  if (!trophies || trophies <= 0) return null
  const count = Math.min(Math.max(1, Math.floor(trophies)), 10)
  return (
    <span
      className={className ?? "text-xs leading-none tracking-tight"}
      title={`Battle champion x${trophies}`}
      aria-label={`Battle champion, ${trophies} wins`}
      role="img"
    >
      {"🏆".repeat(count)}
    </span>
  )
}
