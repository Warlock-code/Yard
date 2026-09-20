"use client"

import { useEffect, useState } from "react"
import { useRouter } from "next/navigation"
import { apiGet, apiPost } from "@/lib/useApi"
import Avatar from "@/app/components/Avatar"
import { useTierTheme } from "@/app/components/ThemeProvider"
import { AVATARS, AVATAR_MAP, isAvatarUnlockedForTier, getRarityColor, getRarityGlow, type AvatarItem } from "@/lib/avatars"
import { THEMES, isThemeUnlocked, type ThemeId } from "@/lib/themes"

type Tier = "FREE" | "PLUS" | "PRIME"

type Me = {
  tier: Tier
  ownedCosmetics: string[]
  avatarEmoji: string
}

const CATEGORIES = [
  { key: "avatars", label: "Avatars" },
  { key: "themes", label: "Themes" },
]

const DEFAULT_AVATAR = { id: "default", name: "Classic Ghost", emoji: "👻", rarity: "common" as const }

export default function OwnedPage() {
  const router = useRouter()
  const [category, setCategory] = useState("avatars")
  const [me, setMe] = useState<Me | null>(null)
  const [loading, setLoading] = useState(true)
  const [equipping, setEquipping] = useState<string | null>(null)
  const { tier, themeChoice, setThemeChoice, ownedCosmetics } = useTierTheme()

  useEffect(() => {
    apiGet("/api/auth/me")
      .then((d) => {
        if (!d.user) {
          router.push("/login")
          return
        }
        setMe(d.user)
      })
      .catch(() => {})
      .finally(() => setLoading(false))
  }, [router])

  async function equipAvatar(emoji: string) {
    if (!me || equipping) return
    setEquipping(emoji)
    try {
      const data = await apiPost("/api/profile/avatar", { emoji })
      setMe((current) => (current ? { ...current, avatarEmoji: data.avatarEmoji } : current))
    } catch (err: unknown) {
      alert(err instanceof Error ? err.message : "Could not equip avatar.")
    } finally {
      setEquipping(null)
    }
  }

  function equipTheme(themeId: ThemeId) {
    try {
      window.localStorage.setItem("yard-theme", themeId)
    } catch {
      // ignore persistence failures
    }
    try {
      setThemeChoice(themeId)
    } catch {
      // context setter unavailable — custom event below still notifies ThemeProvider
    }
    try {
      window.dispatchEvent(new CustomEvent("yard-theme-change", { detail: themeId }))
    } catch {
      // ignore dispatch failures
    }
  }

  if (loading || !me) {
    return (
      <main className="min-h-screen max-w-lg mx-auto pb-28 px-4">
        <div className="pt-5 pb-3">
          <h1 className="text-2xl font-black">Owned</h1>
          <p className="text-white/40 text-sm">Everything you've unlocked.</p>
        </div>
        <div className="card p-5 mt-2 animate-pulse">
          <div className="h-4 w-24 bg-white/10 rounded mb-2" />
          <div className="h-3 w-full bg-white/5 rounded" />
        </div>
      </main>
    )
  }

  const ownedAvatars: (AvatarItem | typeof DEFAULT_AVATAR)[] = [
    DEFAULT_AVATAR,
    ...AVATARS.filter(
      (a) => me.ownedCosmetics.includes(a.id) || isAvatarUnlockedForTier(me.tier, a.id)
    ),
  ]

  const ownedThemes = THEMES.filter((t) => isThemeUnlocked(t.id, tier, ownedCosmetics))
  const activeThemeId: ThemeId = themeChoice && isThemeUnlocked(themeChoice, tier, ownedCosmetics) ? themeChoice : "default"

  return (
    <main className="min-h-screen max-w-lg mx-auto pb-28 px-4">
      <div className="pt-5 pb-3">
        <h1 className="text-2xl font-black">Owned</h1>
        <p className="text-white/40 text-sm">Everything you've unlocked — tap to use.</p>
      </div>

      <div className="flex gap-2 overflow-x-auto pb-3 -mx-1 px-1">
        {CATEGORIES.map((c) => (
          <button
            key={c.key}
            onClick={() => setCategory(c.key)}
            className={`whitespace-nowrap text-xs px-4 py-2 rounded-full border ${
              category === c.key ? "border-primary text-primary bg-primary/10" : "border-white/10 text-white/40"
            }`}
          >
            {c.label}
          </button>
        ))}
      </div>

      {category === "avatars" && (
        <div className="grid grid-cols-2 sm:grid-cols-3 gap-3 mt-2">
          {ownedAvatars.map((a) => {
            const isActive = me.avatarEmoji === a.emoji
            const rarityClass = getRarityColor(a.rarity)
            const rarityGlow = getRarityGlow(a.rarity)
            const isBusy = equipping === a.emoji
            return (
              <div
                key={a.id}
                className={`card p-4 text-center ${isActive ? `border-${rarityClass.replace("text-", "")}/30 ${rarityGlow}` : ""}`}
              >
                <div className="mx-auto mb-2 w-12 h-12 flex items-center justify-center">
                  <Avatar emoji={a.emoji} size={48} />
                </div>
                <p className="font-semibold text-sm">{a.name}</p>
                <p className={`text-xs uppercase mb-3 ${rarityClass}`}>{a.rarity}</p>
                {isActive ? (
                  <button className="w-full text-sm btn-ghost" disabled>
                    ✓ Active
                  </button>
                ) : (
                  <button
                    className="w-full text-sm btn-primary disabled:opacity-50 disabled:cursor-not-allowed"
                    disabled={equipping !== null}
                    onClick={() => equipAvatar(a.emoji)}
                  >
                    {isBusy ? "..." : "Use"}
                  </button>
                )}
              </div>
            )
          })}
        </div>
      )}

      {category === "themes" && (
        <div className="mt-2">
          <p className="text-white/40 text-xs mb-3 px-1">
            These are all the themes you own or have unlocked with your tier.
          </p>
          {ownedThemes.length === 0 ? (
            <p className="text-white/40 text-sm px-1">You don't own any themes yet — check the Shop.</p>
          ) : (
            <div className="grid grid-cols-2 gap-3">
              {ownedThemes.map((theme) => {
                const isActive = activeThemeId === theme.id
                return (
                  <div
                    key={theme.id}
                    className={`card p-4 text-center ${isActive ? `${theme.activeBorderClass} ${theme.activeBgClass}` : ""}`}
                  >
                    <div
                      className="mx-auto mb-2 h-12 w-12 rounded-full border border-white/10"
                      style={{ background: `linear-gradient(135deg, ${theme.swatchFrom} 50%, ${theme.swatchTo} 50%)` }}
                    />
                    <p className="font-semibold text-sm">{theme.name}</p>
                    <p className={`text-xs mb-3 ${isActive ? theme.activeTextClass : "text-white/40"}`}>
                      {isActive ? "✓ Active" : theme.description}
                    </p>
                    {isActive ? (
                      <button className="w-full text-sm btn-ghost" disabled>
                        ✓ Active
                      </button>
                    ) : (
                      <button className="w-full text-sm btn-primary" onClick={() => equipTheme(theme.id)}>
                        Use
                      </button>
                    )}
                  </div>
                )
              })}
            </div>
          )}
        </div>
      )}
    </main>
  )
}
