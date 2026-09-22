export type PurchaseKind =
  | "freeze"
  | "restore"
  | "storage"
  | "boost"
  | "boost_credit"
  | "cosmetic"
  | "custom_name"
  | "plus"
  | "prime"
  | string

export type PurchaseCopy = {
  emoji: string
  title: string
  body: string
  ctaLabel: string
  ctaHref: string
  secondaryHref?: string
  autoRenewNote?: string
}

/**
 * What the buyer can actually DO with each item — shown on the
 * Paystack callback screen instead of a generic "Payment confirmed".
 */
export function getPurchaseCopy(kind: PurchaseKind): PurchaseCopy {
  switch (kind) {
    case "freeze":
      return {
        emoji: "🧊",
        title: "Streak Freeze active",
        body: "Your streak is protected for the next 48 hours. If you miss posting a day, the freeze kicks in automatically and your streak survives — nothing to press, it just works.",
        ctaLabel: "Back to Lair",
        ctaHref: "/lair",
        secondaryHref: "/feed",
      }
    case "restore":
      return {
        emoji: "🔁",
        title: "Streak restored",
        body: "Your last broken streak is back on. Post today to keep it alive — one post a day keeps the count climbing.",
        ctaLabel: "Keep the streak going",
        ctaHref: "/feed",
        secondaryHref: "/lair",
      }
    case "storage":
      return {
        emoji: "💾",
        title: "Storage +100MB added",
        body: "Your media library just grew by 100MB. New photo and voice posts will use the extra space automatically — check your usage anytime in the Lair.",
        ctaLabel: "Back to Lair",
        ctaHref: "/lair",
        secondaryHref: "/shop",
      }
    case "boost":
      return {
        emoji: "🚀",
        title: "Post boosted",
        body: "Your post is now pinned toward the top of everyone's feed while the boost lasts. Watch the yeahs and comments roll in.",
        ctaLabel: "View feed",
        ctaHref: "/feed",
        secondaryHref: "/lair",
      }
    case "boost_credit":
      return {
        emoji: "🚀",
        title: "Boost Credit added",
        body: "You have 1 new Boost Credit. Open any of your posts and hit Boost to push it to the top of the feed for 24 hours — best used on your funniest or wildest post.",
        ctaLabel: "Boost a post",
        ctaHref: "/feed",
        secondaryHref: "/shop",
      }
    case "cosmetic":
      return {
        emoji: "✨",
        title: "New look unlocked",
        body: "Your avatar or theme is now yours forever. Head to the Shop or your Lair to equip it and show it off across all your posts.",
        ctaLabel: "Equip it",
        ctaHref: "/shop",
        secondaryHref: "/lair",
      }
    case "custom_name":
      return {
        emoji: "✏️",
        title: "Ghost name changed",
        body: "Your new ghost name is live across all your posts and comments. Make it memorable — it's how the yard knows you.",
        ctaLabel: "Back to Lair",
        ctaHref: "/lair",
        secondaryHref: "/feed",
      }
    case "plus":
      return {
        emoji: "✨",
        title: "Welcome to Plus",
        body: "More perks, more style: extra boosts, exclusive avatars and priority placement. Your subscription renews monthly — cancel anytime from the upgrade page.",
        ctaLabel: "Back to Lair",
        ctaHref: "/lair",
        autoRenewNote: "Auto-renew is on — we'll deduct GHS 10 monthly automatically. Cancel anytime from upgrade page.",
      }
    case "prime":
      return {
        emoji: "👑",
        title: "Welcome to Prime",
        body: "Every common avatar free, real earnings on your posts, and highest feed priority. Your subscription renews monthly — cancel anytime from the upgrade page.",
        ctaLabel: "Back to Lair",
        ctaHref: "/lair",
        autoRenewNote: "Auto-renew is on — we'll deduct GHS 20 monthly automatically. Cancel anytime from upgrade page.",
      }
    default:
      return {
        emoji: "✅",
        title: "Payment confirmed",
        body: "Your purchase went through and is now active on your account.",
        ctaLabel: "Back to Lair",
        ctaHref: "/lair",
        secondaryHref: "/feed",
      }
  }
}
