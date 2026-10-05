"use client"

import { useEffect, useState } from "react"

type VersionInfo = {
  latestBuild: number
  latestVersion: string
  minBuild: number
  apkUrl: string
}

// Runs only inside the native Android app (Capacitor). Compares the
// installed build (from the native package — works across signing keys)
// against the server's minimum/latest and either banners or blocks.
export default function UpdateGate() {
  const [info, setInfo] = useState<VersionInfo | null>(null)
  const [build, setBuild] = useState<number | null>(null)
  const [dismissed, setDismissed] = useState(false)

  useEffect(() => {
    let cancelled = false
    async function check() {
      try {
        const cap = (window as unknown as { Capacitor?: { isNativePlatform?: () => boolean } }).Capacitor
        if (!cap?.isNativePlatform?.()) return // browser / iphone: not gated
        const { App } = await import("@capacitor/app")
        const { build: buildStr } = await App.getInfo()
        const current = Number.parseInt(buildStr, 10)
        if (!Number.isFinite(current)) return
        const res = await fetch("/api/app-version", { cache: "no-store" })
        if (!res.ok) return
        const data = (await res.json()) as VersionInfo
        if (!cancelled) {
          setBuild(current)
          setInfo(data)
        }
      } catch {
        // Updater must never break the app: fail open.
      }
    }
    check()
    return () => { cancelled = true }
  }, [])

  if (info === null || build === null) return null

  // Below minimum (e.g. v1.0.0, old signing key): hard cutoff.
  if (build < info.minBuild) {
    return (
      <div className="fixed inset-0 z-[100] bg-[#050505] flex items-center justify-center px-6">
        <main className="max-w-sm w-full text-center">
          <p className="text-4xl mb-3">📦</p>
          <h1 className="text-2xl font-black mb-2">update required</h1>
          <p className="text-sm text-white/60 mb-1">
            this version of yard no longer works. get yard v{info.latestVersion} to continue.
          </p>
          <p className="text-sm text-white/60 mb-6">
            coming from the very first version? <span className="text-white font-semibold">uninstall the old yard first</span>, then install the new one. your account is safe — just log in again.
          </p>
          <a href={info.apkUrl} className="btn-primary px-8 py-3 text-base inline-block mb-4">
            download yard v{info.latestVersion}
          </a>
          <p className="text-xs text-white/30">or open yardapp.me/download in your browser</p>
        </main>
      </div>
    )
  }

  // Behind latest but still allowed: dismissible banner.
  if (build < info.latestBuild && !dismissed) {
    return (
      <div className="fixed top-0 left-0 right-0 z-[90] bg-[#baff39] text-black px-4 py-2.5 flex items-center gap-3">
        <p className="flex-1 text-[13px] font-bold">yard v{info.latestVersion} is out — update for the latest fixes.</p>
        <a href={info.apkUrl} className="text-[13px] font-black underline shrink-0">update</a>
        <button onClick={() => setDismissed(true)} aria-label="dismiss" className="text-lg leading-none shrink-0">×</button>
      </div>
    )
  }

  return null
}
