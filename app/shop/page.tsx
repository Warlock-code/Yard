"use client"

import { useState } from "react"
import { apiPost } from "@/lib/useApi"

function ShopItem({ title, price, onBuy }: { title: string; price: string; onBuy: () => void }) {
  return (
    <div className="card p-4 flex items-center justify-between">
      <div>
        <p className="font-semibold text-sm">{title}</p>
        <p className="text-white/40 text-xs">{price}</p>
      </div>
      <button className="btn-ghost" onClick={onBuy}>Buy</button>
    </div>
  )
}

export default function ShopPage() {
  const [loading, setLoading] = useState<string | null>(null)

  async function buy(endpoint: string, key: string, body: any = {}) {
    setLoading(key)
    try {
      const data = await apiPost(endpoint, body)
      if (data.data?.authorization_url) {
        window.location.href = data.data.authorization_url
      }
    } catch (err: any) {
      alert(err.message)
    } finally {
      setLoading(null)
    }
  }

  return (
    <main className="min-h-screen max-w-lg mx-auto pb-24 px-4">
      <h1 className="text-2xl font-black mt-4 mb-4">🛍️ Shop</h1>

      <div className="space-y-3">
        <ShopItem
          title="Streak Freeze (48h)"
          price="GHS 2.00"
          onBuy={() => buy("/api/shop/streak-freeze", "freeze")}
        />
        <ShopItem
          title="Storage +100MB"
          price="GHS 4.00"
          onBuy={() => buy("/api/shop/storage", "storage")}
        />
      </div>

      <p className="text-white/30 text-xs text-center mt-6">
        Want a custom ghost name? Change it from your Lair page.
      </p>
    </main>
  )
}