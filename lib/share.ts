import { isNativeApp } from "@/lib/platform"

export type ShareTarget = "whatsapp" | "twitter" | "native" | "copy"
export type ShareContentType = "post" | "profile" | "battle"

export interface ShareOptions {
  type: ShareContentType
  id: string
  text?: string
  url?: string
  title?: string
}

const BASE_URL = process.env.NEXT_PUBLIC_APP_URL || "https://yardapp.me"
const DEEP_LINK_SCHEME = "yard://"

function buildWebUrl(type: ShareContentType, id: string): string {
  switch (type) {
    case "post":
      return `${BASE_URL}/post/${id}`
    case "profile":
      return `${BASE_URL}/u/${encodeURIComponent(id)}`
    case "battle":
      return `${BASE_URL}/battles/${id}`
    default:
      return BASE_URL
  }
}

function buildDeepLink(type: ShareContentType, id: string): string {
  switch (type) {
    case "post":
      return `${DEEP_LINK_SCHEME}post/${id}`
    case "profile":
      return `${DEEP_LINK_SCHEME}user/${id}`
    case "battle":
      return `${DEEP_LINK_SCHEME}battle/${id}`
    default:
      return DEEP_LINK_SCHEME
  }
}

function getShareText(options: ShareOptions): string {
  const { type, id, text } = options
  const deepLink = buildDeepLink(type, id)
  const webUrl = buildWebUrl(type, id)

  const defaultTexts: Record<ShareContentType, string> = {
    post: "Check out this post on Yard!",
    profile: "Check out this ghost on Yard!",
    battle: "Join this battle on Yard!",
  }

  const baseText = text || defaultTexts[type]
  return `${baseText}\n\n${webUrl}\n\nOpen in app: ${deepLink}`
}

function getWhatsAppUrl(options: ShareOptions): string {
  const text = encodeURIComponent(getShareText(options))
  return `https://wa.me/?text=${text}`
}

function getTwitterUrl(options: ShareOptions): string {
  const text = encodeURIComponent(getShareText(options))
  const url = encodeURIComponent(buildWebUrl(options.type, options.id))
  return `https://twitter.com/intent/tweet?text=${text}&url=${url}`
}

export async function shareContent(options: ShareOptions, target: ShareTarget = "native"): Promise<boolean> {
  const webUrl = buildWebUrl(options.type, options.id)
  const deepLink = buildDeepLink(options.type, options.id)
  const shareText = getShareText(options)

  switch (target) {
    case "whatsapp": {
      const url = getWhatsAppUrl(options)
      if (isNativeApp()) {
        window.open(url, "_blank")
      } else {
        window.open(url, "_blank", "noopener,noreferrer")
      }
      return true
    }
    case "twitter": {
      const url = getTwitterUrl(options)
      if (isNativeApp()) {
        window.open(url, "_blank")
      } else {
        window.open(url, "_blank", "noopener,noreferrer")
      }
      return true
    }
    case "copy": {
      await navigator.clipboard.writeText(`${shareText}\n\n${webUrl}`)
      return true
    }
    case "native":
    default: {
      if (navigator.share) {
        try {
          await navigator.share({
            title: options.title || "Yard",
            text: shareText,
            url: webUrl,
          })
          return true
        } catch (err) {
          if (err instanceof Error && err.name === "AbortError") {
            return false
          }
        }
      }
      await navigator.clipboard.writeText(`${shareText}\n\n${webUrl}`)
      return true
    }
  }
}

export function parseDeepLink(url: string): { type: ShareContentType; id: string } | null {
  try {
    const urlObj = new URL(url)
    if (urlObj.protocol !== "yard:") return null

    const path = urlObj.pathname.replace(/^\//, "")
    const [type, id] = path.split("/")

    if (type === "post" && id) return { type: "post", id }
    if (type === "user" && id) return { type: "profile", id }
    if (type === "battle" && id) return { type: "battle", id }

    return null
  } catch {
    return null
  }
}

export function generateInviteCode(): string {
  const chars = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789"
  let code = ""
  for (let i = 0; i < 8; i++) {
    const cryptoObj = globalThis.crypto as unknown as { getRandomValues?: (a: Uint32Array) => Uint32Array } | undefined
    if (typeof crypto !== "undefined" && typeof (crypto as any).randomInt === "function") {
      code += chars.charAt((crypto as any).randomInt(chars.length))
    } else if (cryptoObj?.getRandomValues) {
      const arr = new Uint32Array(1)
      cryptoObj.getRandomValues(arr)
      code += chars.charAt(arr[0] % chars.length)
    } else {
      code += chars.charAt(Math.floor(Math.random() * chars.length))
    }
  }
  return code
}

export function getShareTargets(): ShareTarget[] {
  const targets: ShareTarget[] = ["native", "copy"]
  if (typeof window !== "undefined") {
    targets.unshift("whatsapp", "twitter")
  }
  return targets
}

export { buildWebUrl, buildDeepLink, getShareText, getWhatsAppUrl, getTwitterUrl }