export type AvatarRarity = "common" | "rare" | "epic" | "legendary"

export type AvatarItem = {
  id: string
  name: string
  emoji: string
  pricePesewas: number
  rarity: AvatarRarity
}

export const AVATARS: AvatarItem[] = [
  { id: "avatar_snake", name: "Snake", emoji: "🐍", pricePesewas: 200, rarity: "common" },
  { id: "avatar_alien", name: "Alien", emoji: "👽", pricePesewas: 200, rarity: "common" },
  { id: "avatar_witch", name: "Witch", emoji: "🧙", pricePesewas: 300, rarity: "rare" },
  { id: "avatar_bat", name: "Bat", emoji: "🦇", pricePesewas: 300, rarity: "rare" },
  { id: "avatar_spider", name: "Spider", emoji: "🕷️", pricePesewas: 300, rarity: "rare" },
  { id: "avatar_laughing", name: "Laughing", emoji: "😂", pricePesewas: 350, rarity: "rare" },
  { id: "avatar_unicorn", name: "Unicorn", emoji: "🦄", pricePesewas: 1200, rarity: "legendary" },
  { id: "avatar_crown", name: "Crown", emoji: "👑", pricePesewas: 1000, rarity: "legendary" },
  { id: "avatar_genie", name: "Genie", emoji: "🧞", pricePesewas: 1100, rarity: "legendary" },
  { id: "avatar_ufo", name: "UFO", emoji: "🛸", pricePesewas: 1300, rarity: "legendary" },
  { id: "avatar_robot", name: "Robot", emoji: "🤖", pricePesewas: 900, rarity: "epic" },
  { id: "avatar_evil_eye", name: "Evil Eye", emoji: "🧿", pricePesewas: 700, rarity: "epic" },
  { id: "avatar_skeleton", name: "Skeleton", emoji: "💀", pricePesewas: 800, rarity: "epic" },
  { id: "avatar_ninja", name: "Ninja", emoji: "🥷", pricePesewas: 900, rarity: "epic" },
  { id: "avatar_vampire", name: "Vampire", emoji: "🧛", pricePesewas: 750, rarity: "epic" },
  { id: "avatar_mermaid", name: "Mermaid", emoji: "🧜", pricePesewas: 800, rarity: "epic" },
  { id: "avatar_fairy", name: "Fairy", emoji: "🧚", pricePesewas: 850, rarity: "epic" },
  { id: "avatar_zombie", name: "Zombie", emoji: "🧟", pricePesewas: 600, rarity: "epic" },
  { id: "avatar_dragon", name: "Dragon", emoji: "🐲", pricePesewas: 850, rarity: "epic" },
  { id: "avatar_fireworks", name: "Fireworks", emoji: "🎆", pricePesewas: 650, rarity: "epic" },
  { id: "avatar_cat", name: "Cat", emoji: "🐱", pricePesewas: 250, rarity: "common" },
  { id: "avatar_dog", name: "Dog", emoji: "🐶", pricePesewas: 250, rarity: "common" },
  { id: "avatar_panda", name: "Panda", emoji: "🐼", pricePesewas: 300, rarity: "common" },
  { id: "avatar_frog", name: "Frog", emoji: "🐸", pricePesewas: 200, rarity: "common" },
  { id: "avatar_owl", name: "Owl", emoji: "🦉", pricePesewas: 200, rarity: "common" },
  { id: "avatar_penguin", name: "Penguin", emoji: "🐧", pricePesewas: 250, rarity: "common" },
  { id: "avatar_octopus", name: "Octopus", emoji: "🐙", pricePesewas: 300, rarity: "common" },
  { id: "avatar_star", name: "Star", emoji: "⭐", pricePesewas: 400, rarity: "rare" },
  { id: "avatar_flame", name: "Flame", emoji: "🔥", pricePesewas: 350, rarity: "rare" },
  { id: "avatar_rainbow", name: "Rainbow", emoji: "🌈", pricePesewas: 400, rarity: "rare" },
  { id: "avatar_galaxy", name: "Galaxy", emoji: "🌌", pricePesewas: 500, rarity: "rare" },
  { id: "avatar_rocket", name: "Rocket", emoji: "🚀", pricePesewas: 500, rarity: "rare" },
  { id: "avatar_trophy", name: "Trophy", emoji: "🏆", pricePesewas: 450, rarity: "rare" },
  { id: "avatar_gem", name: "Gem", emoji: "💎", pricePesewas: 500, rarity: "rare" },
]

export const AVATAR_MAP: Record<string, AvatarItem> = Object.fromEntries(
  AVATARS.map((avatar) => [avatar.id, avatar])
)

export const AVATAR_EMOJI_MAP: Record<string, string> = Object.fromEntries(
  AVATARS.map((avatar) => [avatar.id, avatar.emoji])
)

export const COMMON_AVATAR_IDS = AVATARS.filter((a) => a.rarity === "common").map((a) => a.id)
export const PLUS_AVATAR_IDS = COMMON_AVATAR_IDS
export const PRIME_AVATAR_IDS = COMMON_AVATAR_IDS

export function getAvatarsForTier(tier: "FREE" | "PLUS" | "PRIME"): AvatarItem[] {
  if (tier === "FREE") return []
  return AVATARS.filter((a) => a.rarity === "common")
}

export function getAvatarPriceForTier(tier: "FREE" | "PLUS" | "PRIME", avatar: AvatarItem): number {
  if (tier === "PRIME" && avatar.rarity === "common") return 0
  return avatar.pricePesewas
}

export function isAvatarUnlockedForTier(tier: "FREE" | "PLUS" | "PRIME", avatarId: string): boolean {
  if (tier === "FREE") return false
  const avatar = AVATAR_MAP[avatarId]
  if (!avatar) return false
  return avatar.rarity === "common"
}

export function getRarityColor(rarity: AvatarRarity): string {
  switch (rarity) {
    case "common": return "text-white/40"
    case "rare": return "text-sky-300"
    case "epic": return "text-fuchsia-300"
    case "legendary": return "text-[#facc15]"
  }
}

export function getRarityGlow(rarity: AvatarRarity): string {
  switch (rarity) {
    case "common": return "bg-white/5"
    case "rare": return "bg-sky-500/10"
    case "epic": return "bg-fuchsia-500/10"
    case "legendary": return "bg-[#facc15]/10"
  }
}