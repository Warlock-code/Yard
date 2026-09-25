export type ThemeId = "default" | "blue" | "gold" | "purple" | "crimson" | "teal" | "rainbow"

export type ThemeDef = {
  id: ThemeId
  name: string
  description: string
  /** 0 = free. Free themes are either available to everyone (no tier gate)
   *  or unlocked automatically once the account holds `requiresTier`. */
  pricePesewas: number
  /** Tier perk gate for free themes. Undefined = no tier requirement. */
  requiresTier?: "PLUS" | "PRIME"
  swatchFrom: string
  swatchTo: string
  /** Class applied to <html> when this theme is active. */
  className: `theme-${string}`
  activeTextClass: string
  activeBorderClass: string
  activeBgClass: string
}

export const THEMES: ThemeDef[] = [
  {
    id: "default",
    name: "Default Green",
    description: "Classic Yard look — on for everyone.",
    pricePesewas: 0,
    swatchFrom: "#baff39",
    swatchTo: "#050505",
    className: "theme-default",
    activeTextClass: "text-primary",
    activeBorderClass: "border-[#baff39]/40",
    activeBgClass: "bg-[#baff39]/5",
  },
  {
    id: "blue",
    name: "Plus Blue",
    description: "Plus perk — opt-in.",
    pricePesewas: 0,
    requiresTier: "PLUS",
    swatchFrom: "#38bdf8",
    swatchTo: "#050505",
    className: "theme-blue",
    activeTextClass: "text-sky-300",
    activeBorderClass: "border-sky-500/40",
    activeBgClass: "bg-sky-500/5",
  },
  {
    id: "gold",
    name: "Prime Gold",
    description: "Prime perk — opt-in.",
    pricePesewas: 0,
    requiresTier: "PRIME",
    swatchFrom: "#facc15",
    swatchTo: "#050505",
    className: "theme-gold",
    activeTextClass: "text-[#facc15]",
    activeBorderClass: "border-[#facc15]/40",
    activeBgClass: "bg-[#facc15]/5",
  },
  {
    id: "purple",
    name: "Purple Haze",
    description: "700 credits — one-time.",
    pricePesewas: 70000,
    swatchFrom: "#a855f7",
    swatchTo: "#050505",
    className: "theme-purple",
    activeTextClass: "text-purple-300",
    activeBorderClass: "border-purple-500/40",
    activeBgClass: "bg-purple-500/5",
  },
  {
    id: "crimson",
    name: "Crimson",
    description: "700 credits — one-time.",
    pricePesewas: 70000,
    swatchFrom: "#f43f5e",
    swatchTo: "#050505",
    className: "theme-crimson",
    activeTextClass: "text-rose-300",
    activeBorderClass: "border-rose-500/40",
    activeBgClass: "bg-rose-500/5",
  },
  {
    id: "teal",
    name: "Deep Teal",
    description: "700 credits — one-time.",
    pricePesewas: 70000,
    swatchFrom: "#14b8a6",
    swatchTo: "#050505",
    className: "theme-teal",
    activeTextClass: "text-teal-300",
    activeBorderClass: "border-teal-500/40",
    activeBgClass: "bg-teal-500/5",
  },
  {
    id: "rainbow",
    name: "Rainbow",
    description: "1500 credits — one-time.",
    pricePesewas: 150000,
    swatchFrom: "#ff0080",
    swatchTo: "#7928ca",
    className: "theme-rainbow",
    activeTextClass: "text-pink-300",
    activeBorderClass: "border-pink-500/40",
    activeBgClass: "bg-pink-500/5",
  },
]

export const THEME_MAP: Record<ThemeId, ThemeDef> = Object.fromEntries(
  THEMES.map((t) => [t.id, t])
) as Record<ThemeId, ThemeDef>

export const THEME_IDS = THEMES.map((t) => t.id)

export const THEME_CLASS_NAMES = THEMES.map((t) => t.className)

/** Cosmetic id stored in `user.ownedCosmetics` once a paid theme is purchased. */
export function themeCosmeticId(themeId: ThemeId): string {
  return `theme_${themeId}`
}

export function isThemeId(value: unknown): value is ThemeId {
  return typeof value === "string" && THEME_IDS.includes(value as ThemeId)
}

/** Purchasable (non-free) themes shown in the Shop with a price tag. */
export function getPurchasableThemes(): ThemeDef[] {
  return THEMES.filter((t) => t.pricePesewas > 0)
}

/** Free themes gated by subscription tier (Default is free-for-all, handled separately). */
export function getPerkThemes(): ThemeDef[] {
  return THEMES.filter((t) => t.pricePesewas === 0 && t.requiresTier)
}

export function isThemeUnlocked(
  themeId: ThemeId,
  tier: "FREE" | "PLUS" | "PRIME",
  ownedCosmetics: readonly string[]
): boolean {
  const def = THEME_MAP[themeId]
  if (!def) return false
  if (def.pricePesewas === 0) {
    if (!def.requiresTier) return true
    if (def.requiresTier === "PLUS") return tier === "PLUS" || tier === "PRIME"
    if (def.requiresTier === "PRIME") return tier === "PRIME"
    return false
  }
  return ownedCosmetics.includes(themeCosmeticId(themeId))
}
