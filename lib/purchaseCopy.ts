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
        title: "streak Freeze active",
        body: "your streak is protected for the next 48 hours. If you miss posting a day, the freeze kicks in automatically and your streak survives — nothing to press, it just works.",
        ctaLabel: "back to Lair",
        ctaHref: "/lair",
        secondaryHref: "/feed",
      }
    case "restore":
      return {
        emoji: "🔁",
        title: "streak restored",
        body: "your last broken streak is back on. Post today to keep it alive — one post a day keeps the count climbing.",
        ctaLabel: "keep the streak going",
        ctaHref: "/feed",
        secondaryHref: "/lair",
      }
    case "storage":
      return {
        emoji: "💾",
        title: "storage +100MB added",
        body: "your media library just grew by 100MB. New photo and voice posts will use the extra space automatically — check your usage anytime in the Lair.",
        ctaLabel: "back to Lair",
        ctaHref: "/lair",
        secondaryHref: "/shop",
      }
    case "boost":
      return {
        emoji: "🚀",
        title: "post boosted",
        body: "your post is now pinned toward the top of everyone's feed while the boost lasts. Watch the yeahs and comments roll in.",
        ctaLabel: "view feed",
        ctaHref: "/feed",
        secondaryHref: "/lair",
      }
    case "boost_credit":
      return {
        emoji: "🚀",
        title: "boost Credit added",
        body: "you have 1 new Boost Credit. Open any of your posts and hit Boost to push it to the top of the feed for 24 hours — best used on your funniest or wildest post.",
        ctaLabel: "boost a post",
        ctaHref: "/feed",
        secondaryHref: "/shop",
      }
    case "cosmetic":
      return {
        emoji: "✨",
        title: "new look unlocked",
        body: "your avatar or theme is now yours forever. Head to the Shop or your Lair to equip it and show it off across all your posts.",
        ctaLabel: "equip it",
        ctaHref: "/shop",
        secondaryHref: "/lair",
      }
    case "custom_name":
      return {
        emoji: "✏️",
        title: "ghost name changed",
        body: "your new ghost name is live across all your posts and comments. Make it memorable — it's how the yard knows you.",
        ctaLabel: "back to Lair",
        ctaHref: "/lair",
        secondaryHref: "/feed",
      }
    case "plus":
      return {
        emoji: "✨",
        title: "welcome to Plus",
        body: "more perks, more style: extra boosts, exclusive avatars and priority placement. Your subscription renews monthly — cancel anytime from the upgrade page.",
        ctaLabel: "back to Lair",
        ctaHref: "/lair",
        autoRenewNote: "auto-renew is on — we'll deduct GHS 10 monthly automatically. Cancel anytime from upgrade page.",
      }
    case "prime":
      return {
        emoji: "👑",
        title: "welcome to Prime",
        body: "every common avatar free, 2x credit rewards on your posts, and highest feed priority. Your subscription renews monthly — cancel anytime from the upgrade page.",
        ctaLabel: "back to Lair",
        ctaHref: "/lair",
        autoRenewNote: "auto-renew is on — we'll deduct GHS 20 monthly automatically. Cancel anytime from upgrade page.",
      }
    default:
      return {
        emoji: "✅",
        title: "payment confirmed",
        body: "your purchase went through and is now active on your account.",
        ctaLabel: "back to Lair",
        ctaHref: "/lair",
        secondaryHref: "/feed",
      }
  }
}
