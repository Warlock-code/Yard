"use client"

import { useRouter } from "next/navigation"
import { apiPost } from "@/lib/useApi"
import { blockIfNative } from "@/lib/purchaseGate"

export default function UpgradePage() {
  const router = useRouter()

  async function handleSubscribe(tier: "plus" | "prime") {
    if (blockIfNative()) return
    try {
      const data = await apiPost(`/api/subscribe/${tier}`, {})
      if (data.data?.authorization_url) window.location.href = data.data.authorization_url
    } catch (err: unknown) {
      alert(err instanceof Error ? err.message : "Something went wrong.")
    }
  }

  return (
    <main className="min-h-screen max-w-lg mx-auto pb-28 px-4">
      <div className="flex items-center gap-3 pt-5 pb-3">
        <button onClick={() => router.back()} className="text-white/60">←</button>
        <h1 className="text-xl font-bold">Upgrade</h1>
      </div>

      <div className="card p-5 mb-4">
        <p className="font-bold text-lg mb-1">Plus — GHS 10/month</p>
        <ul className="text-sm text-white/70 space-y-1 mb-4 mt-2">
          <li>✓ 3 avatar options (Ghost, Snake, Alien)</li>
          <li>✓ Edit your posts</li>
          <li>✓ Priority in Battles</li>
        </ul>
        <button className="btn-ghost w-full" onClick={() => handleSubscribe("plus")}>Get Plus</button>
      </div>

      <div className="card p-5 border-[#facc15]/30">
        <p className="font-bold text-lg mb-1 text-[#facc15]">👑 Prime — GHS 20/month</p>
        <ul className="text-sm text-white/70 space-y-1 mb-4 mt-2">
          <li>✓ Everything in Plus</li>
          <li>✓ All 7 avatars unlocked</li>
          <li>✓ Real cash earnings from votes & battle wins</li>
          <li>✓ Request payouts (min GHS 20)</li>
          <li>✓ Early access to new features</li>
        </ul>
        <button className="btn-primary w-full" onClick={() => handleSubscribe("prime")}>Go Prime</button>
      </div>
    </main>
  )
}