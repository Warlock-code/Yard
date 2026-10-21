import { NextResponse } from "next/server"
import { getVapidConfig } from "@/lib/vapid"

export const dynamic = "force-dynamic"

// Public by design: browsers need this key for pushManager.subscribe().
// Serving it at runtime avoids depending on NEXT_PUBLIC_* being present at
// build time (Next.js only inlines those values during `next build`).
export async function GET() {
  const config = getVapidConfig()
  const headers = { "Cache-Control": "no-store" }

  if (!config.configured) {
    console.error("[PUSH CONFIG]", config.warning)
    return NextResponse.json(
      { configured: false, publicKey: null, error: config.warning },
      { status: 503, headers }
    )
  }

  return NextResponse.json(
    {
      configured: true,
      publicKey: config.publicKey,
      source: config.source,
      warning: config.warning,
    },
    { headers }
  )
}
