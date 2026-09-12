"use client"

import { Suspense, useEffect, useState } from "react"
import { useRouter, useSearchParams } from "next/navigation"
import { apiPost } from "@/lib/useApi"

function CallbackContent() {
  const router = useRouter()
  const searchParams = useSearchParams()
  const reference = searchParams.get("reference") || searchParams.get("trxref")
  const [status, setStatus] = useState<"checking" | "success" | "failed">("checking")

  useEffect(() => {
    if (!reference) {
      setStatus("failed")
      return
    }
    apiPost("/api/paystack/verify", { reference })
      .then(() => setStatus("success"))
      .catch(() => setStatus("failed"))
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
          <p className="font-semibold mb-4">We couldn't confirm that payment.</p>
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