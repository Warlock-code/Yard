"use client"

import { Suspense } from "react"
import { useRouter, useSearchParams } from "next/navigation"

function ComingSoonContent() {
  const router = useRouter()
  const searchParams = useSearchParams()
  const feature = searchParams.get("feature") || "This feature"

  return (
    <main className="min-h-screen flex flex-col items-center justify-center px-6 text-center">
      <p className="text-4xl mb-4">🔒</p>
      <h1 className="text-xl font-bold mb-2">{feature}</h1>
      <p className="text-white/50 text-sm mb-6">
        Coming soon. Upgrade to Prime to get early access when it drops.
      </p>
      <button className="btn-primary px-6 mb-3" onClick={() => router.push("/lair")}>
        Upgrade to Prime
      </button>
      <button className="btn-ghost px-6" onClick={() => router.back()}>
        Go back
      </button>
    </main>
  )
}

export default function ComingSoonPage() {
  return (
    <Suspense>
      <ComingSoonContent />
    </Suspense>
  )
}