"use client"

import { Suspense, useEffect, useState } from "react"
import { useRouter, useSearchParams } from "next/navigation"
import { apiPost } from "@/lib/useApi"
import { isNativeApp } from "@/lib/platform"
import { getPurchaseCopy } from "@/lib/purchaseCopy"

function CallbackContent() {
  const router = useRouter()
  const searchParams = useSearchParams()
  const reference = searchParams.get("reference") || searchParams.get("trxref")
  const fromApp = searchParams.get("from_app") === "1"
  const [result, setResult] = useState<{ reference: string; status: "success" | "failed"; kind?: string } | null>(null)
  const status = !reference ? "failed" : result?.reference === reference ? result.status : "checking"
  const copy = getPurchaseCopy(result?.kind ?? "")

  useEffect(() => {
    if (!reference) return
    let active = true
    apiPost("/api/paystack/verify", { reference })
      .then((data) => {
        if (active) setResult({ reference, status: "success", kind: typeof data?.kind === "string" ? data.kind : undefined })
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
          <p className="text-white/30 text-xs mt-2">One moment while we verify with Paystack.</p>
        </>
      )}
      {status === "success" && (
        <>
          <p className="text-2xl mb-2">{copy.emoji}</p>
          <p className="font-semibold mb-1">{copy.title}</p>
          <p className="text-white/50 text-sm mb-4">{copy.body}</p>
          {copy.autoRenewNote && (
            <p className="text-white/30 text-xs mb-4">{copy.autoRenewNote}</p>
          )}
          <div className="flex flex-col gap-2 w-full max-w-xs">
            <button className="btn-primary px-6" onClick={() => router.push(copy.ctaHref)}>
              {copy.ctaLabel}
            </button>
            {copy.secondaryHref && (
              <button className="btn-ghost px-6" onClick={() => router.push(copy.secondaryHref!)}>
                {copy.secondaryHref === "/feed" ? "Back to Feed" : "Continue"}
              </button>
            )}
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