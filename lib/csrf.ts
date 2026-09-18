import { NextRequest, NextResponse } from "next/server"

const ALLOWED_ORIGINS = [
  "http://localhost:3000",
  "https://yardapp.me",
  "https://www.yardapp.me",
  "capacitor://localhost",
  "ionic://localhost",
]

export function checkOrigin(req: NextRequest): NextResponse | null {
  const origin = req.headers.get("origin")
  const referer = req.headers.get("referer")

  if (!origin && !referer) {
    return NextResponse.json({ error: "Missing origin/referer." }, { status: 403 })
  }

  const checkUrl = origin || referer
  if (!checkUrl) return NextResponse.json({ error: "Missing origin/referer." }, { status: 403 })

  try {
    const url = new URL(checkUrl)
    const isAllowed = ALLOWED_ORIGINS.some((allowed) => {
      const allowedUrl = new URL(allowed)
      return url.hostname === allowedUrl.hostname && url.protocol === allowedUrl.protocol
    })

    if (!isAllowed) {
      return NextResponse.json({ error: "Invalid origin." }, { status: 403 })
    }
  } catch {
    return NextResponse.json({ error: "Invalid origin/referer." }, { status: 403 })
  }

  return null
}

export function withOriginCheck(handler: (req: NextRequest) => Promise<NextResponse>) {
  return async (req: NextRequest) => {
    const originError = checkOrigin(req)
    if (originError) return originError
    return handler(req)
  }
}