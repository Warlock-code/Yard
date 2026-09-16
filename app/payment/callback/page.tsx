"use client"

import { Suspense, useEffect, useState } from "react"
import { useRouter, useSearchParams } from "next/navigation"
import { apiPost } from "@/lib/useApi"

function CallbackContent() {
  const router = useRouter()
  const searchParams = useSearchParams()
  const reference = searchParams.get("reference") || searchParams.get("trxref")
  const [result, setResult] = useState<{ reference: string; status: "success" | "failed" } | null>(null)
  const status = !reference ? "failed" : result?.reference === reference ? result.status : "checking"

  useEffect(() => {
    if (!reference) return
    let active = true
    apiPost("/api/paystack/verify", { reference })
      .then(() => {
        if (active) setResult({ reference, status: "success" })
      })
      .catch(() => {
        if (active) setResult({ reference, status: "failed" })
      })
    return () => { active = false }
  }, [reference])

  return (
    <main className="min-h-screen flex flex-col items-center justify-center px-6 text-center">
      {status === "checking" && <p className="text-white/60">Confirming your payment...</p>}
      {status === "success" && (
        <>
          <p className="text-2xl mb-2">✅</p>
          <p className="font-semibold mb-4">Payment confirmed</p>
          <button className="btn-primary px-6" onClick={() => router.push("/lair")}>
            Back to Lair
          </button>
        </>
      )}
      {status === "failed" && (
        <>
          <p className="text-2xl mb-2">❌</p>
          <p className="font-semibold mb-4">We couldn&apos;t confirm that payment.</p>
          <button className="btn-primary px-6" onClick={() => router.push("/feed")}>
            Back to Feed
          </button>
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