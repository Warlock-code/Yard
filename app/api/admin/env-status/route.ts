import { NextRequest, NextResponse } from "next/server"
import { isAdmin } from "@/lib/getAdmin"

export const dynamic = "force-dynamic"

// Never return full secret values — only presence, length and a non-sensitive
// prefix (e.g. pk_test / pk_live) so admin can verify test-vs-live at a glance.
function keyState(v: string | undefined) {
  if (!v) return { set: false, chars: 0, prefix: null as string | null, mode: null as "test" | "live" | null }
  return {
    set: true,
    chars: v.length,
    prefix: v.slice(0, 7),
    mode: v.includes("test") ? ("test" as const) : v.includes("live") ? ("live" as const) : null,
  }
}

function flag(v: string | undefined) {
  return { set: !!v, chars: v?.length || 0 }
}

export async function GET(req: NextRequest) {
  if (!isAdmin(req)) return NextResponse.json({ error: "Not authorized." }, { status: 403 })

  return NextResponse.json({
    // Source of truth is the server .env (loaded into process.env).
    source: "server .env",
    paystack: {
      publicKey: keyState(process.env.PAYSTACK_PUBLIC_KEY),
      secretKey: keyState(process.env.PAYSTACK_SECRET_KEY),
      webhookSecret: flag(process.env.PAYSTACK_WEBHOOK_SECRET),
      plusPlan: process.env.PAYSTACK_PLUS_PLAN_CODE || null,
      primePlan: process.env.PAYSTACK_PRIME_PLAN_CODE || null,
      plusPricePesewas: Number(process.env.PAYSTACK_PLUS_PRICE_PESEWAS || 1000),
      primePricePesewas: Number(process.env.PAYSTACK_PRIME_PRICE_PESEWAS || 2000),
    },
    security: {
      payoutEncryption: flag(process.env.PAYOUT_ENCRYPTION_KEY),
      jwt: flag(process.env.JWT_SECRET),
      adminJwt: flag(process.env.ADMIN_JWT_SECRET),
      cron: flag(process.env.CRON_SECRET),
    },
    services: {
      resend: flag(process.env.RESEND_API_KEY),
      uploadthing: flag(process.env.UPLOADTHING_TOKEN),
      openrouter: flag(process.env.OPENROUTER_API_KEY),
      firebase: flag(process.env.FIREBASE_SERVICE_ACCOUNT),
      vapid: flag(process.env.VAPID_PRIVATE_KEY),
      database: flag(process.env.DATABASE_URL),
    },
    env: {
      nodeEnv: process.env.NODE_ENV || "unknown",
      appUrl: process.env.NEXT_PUBLIC_APP_URL || "https://yardapp.me",
    },
  })
}
