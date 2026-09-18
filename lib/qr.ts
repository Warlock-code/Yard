import QRCode from "qrcode"

export interface QRCodeOptions {
  width?: number
  margin?: number
  color?: {
    dark?: string
    light?: string
  }
  errorCorrectionLevel?: "L" | "M" | "Q" | "H"
}

const DEFAULT_OPTIONS: Required<QRCodeOptions> = {
  width: 256,
  margin: 2,
  color: {
    dark: "#baff39",
    light: "#000000",
  },
  errorCorrectionLevel: "M",
}

export async function generateQRCodeDataURL(
  data: string,
  options: QRCodeOptions = {}
): Promise<string> {
  const mergedOptions = { ...DEFAULT_OPTIONS, ...options }
  return QRCode.toDataURL(data, mergedOptions)
}

export async function generateQRCodeSVG(
  data: string,
  options: QRCodeOptions = {}
): Promise<string> {
  const mergedOptions = { ...DEFAULT_OPTIONS, ...options }
  return QRCode.toString(data, { ...mergedOptions, type: "svg" })
}

export async function generateProfileQRCode(ghostId: string): Promise<string> {
  const deepLink = `yard://user/${ghostId}`
  const webUrl = `${process.env.NEXT_PUBLIC_APP_URL || "https://yardapp.me"}/u/${encodeURIComponent(ghostId)}`
  return generateQRCodeDataURL(webUrl)
}

export async function generatePostQRCode(postId: string): Promise<string> {
  const webUrl = `${process.env.NEXT_PUBLIC_APP_URL || "https://yardapp.me"}/post/${postId}`
  return generateQRCodeDataURL(webUrl)
}

export async function generateBattleQRCode(battleId: string): Promise<string> {
  const webUrl = `${process.env.NEXT_PUBLIC_APP_URL || "https://yardapp.me"}/battles/${battleId}`
  return generateQRCodeDataURL(webUrl)
}

export async function generateInviteQRCode(inviteCode: string): Promise<string> {
  const webUrl = `${process.env.NEXT_PUBLIC_APP_URL || "https://yardapp.me"}/signup?ref=${inviteCode}`
  return generateQRCodeDataURL(webUrl)
}