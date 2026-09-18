"use client"

import { Suspense, useEffect, useState } from "react"
import { useRouter, useSearchParams } from "next/navigation"
import { apiPost } from "@/lib/useApi"
import { isNativeApp } from "@/lib/platform"

function CallbackContent() {
  const router = useRouter()
  const searchParams = useSearchParams()
  const reference = searchParams.get("reference") || searchParams.get("trxref")
  const fromApp = searchParams.get("from_app") === "1"
  const [result, setResult] = useState<{ reference: string; status: "success" | "failed" } | null>(null)
  const status = !reference ? "failed" : result?.reference === reference ? result.status : "checking"

  useEffect(() => {
    if (!reference) return
    let active = true
    apiPost("/api/paystack/verify", { reference })
      .then(() => {
        if (active) setResult({ reference, status: "success" })
        // If opened in Chrome Custom Tab from app, close it so user returns to app (App Link will keep them)
        if (isNativeApp() || fromApp) {
          import("@capacitor/browser").then(({ Browser }) => Browser.close().catch(() => {})).catch(() => {})
        }
      })
      .catch(() => {
        if (active) setResult({ reference, status: "failed" })
      })
    return () => { active = false }
  }, [reference, fromApp])

  // If this page is loaded inside external browser but user has app installed, offer to open app
  const appLink = reference ? `https://yardapp.me/payment/callback?reference=${encodeURIComponent(reference)}` : "/lair"
  const intentLink = reference ? `intent://yardapp.me/payment/callback?reference=${encodeURIComponent(reference)}#Intent;scheme=https;package=me.yardapp.app;S.browser_fallback_url=https://yardapp.me/payment/callback?reference=${encodeURIComponent(reference)};end` : ""

  return (
    <main className="min-h-screen flex flex-col items-center justify-center px-6 text-center">
      {status === "checking" && (
        <>
          <div className="animate-spin rounded-full h-8 w-8 border-2 border-[#baff39] border-t-transparent mb-3" />
          <p className="text-white/60">Confirming your payment...</p>
          <p className="text-white/30 text-xs mt-2">Auto-renew enabled — Prime/Plus will renew monthly with no action.</p>
        </>
      )}
      {status === "success" && (
        <>
          <p className="text-2xl mb-2">✅</p>
          <p className="font-semibold mb-1">Payment confirmed</p>
          <p className="text-white/50 text-sm mb-4">Auto-renew is on — we&apos;ll deduct GHS 10/20 monthly automatically. Cancel anytime from upgrade page.</p>
          <div className="flex flex-col gap-2 w-full max-w-xs">
            <button className="btn-primary px-6" onClick={() => router.push("/lair")}>
              Back to Lair
            </button>
            {fromApp && (
              <a className="btn-ghost text-center text-sm" href={intentLink}>
                Open in Yard app →
              </a>
            )}
          </div>
        </>
      )}
      {status === "failed" && (
        <>
          <p className="text-2xl mb-2">❌</p>
          <p className="font-semibold mb-2">We couldn&apos;t confirm that payment.</p>
          <p className="text-white/40 text-sm mb-4">Webhook may still be processing — check /lair in 30s. If charged but not upgraded, contact support with ref: {reference}</p>
          <div className="flex flex-col gap-2 w-full max-w-xs">
            <button className="btn-primary px-6" onClick={() => router.push("/lair")}>
              Check Lair
            </button>
            <button className="btn-ghost px-6" onClick={() => router.push("/feed")}>
              Back to Feed
            </button>
            {fromApp && (
              <a className="text-xs text-white/30 mt-2" href={appLink}>
                Continue in browser
              </a>
            )}
          </div>
        </>
      )}
    </main>
  )
}

export default function PaymentCallbackPage() {
  return (
    <Suspense>
      <CallbackContent />
    </Suspense>
  )
}