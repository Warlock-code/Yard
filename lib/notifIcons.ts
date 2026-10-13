// Notification icon mapping (shared). Lives here — not in the page file —
// because Next.js page modules may only export default (+ metadata/viewport).
// Every notification type resolves to a themed emoji; unknown types fall back
// to 🔔.
export function notificationIcon(type?: string, icon?: string) {
  if (icon) return icon
  const t = (type || "").toLowerCase()
  if (t.includes("tip") || t.includes("credit") || t.includes("refund") || t.includes("wheel") || t.includes("mystery") || t.includes("reward") || t.includes("earning") || t.includes("streak")) return "💸"
  if (t.includes("battle") || t.includes("duel") || t.includes("war") || t.includes("vote") || t.includes("hot") || t.includes("trending")) return "🔥"
  if (t.includes("win") || t.includes("crown") || t.includes("champion") || t.includes("contest") || t.includes("leaderboard") || t.includes("cotd") || t.includes("confession")) return "🏆"
  if (t.includes("ghost") || t.includes("mention") || t.includes("reply") || t.includes("profile_view") || t.includes("lurker") || t.includes("view")) return "👻"
  if (t.includes("gift") || t.includes("invite") || t.includes("referral") || t.includes("drop") || t.includes("winback") || t.includes("welcome") || t.includes("return")) return "🎁"
  if (t.includes("freeze") || t.includes("storage") || t.includes("upload") || t.includes("download") || t.includes("update") || t.includes("app")) return "💾"
  if (t.includes("plus") || t.includes("prime") || t.includes("subscri")) return "💎"
  return "🔔"
}
