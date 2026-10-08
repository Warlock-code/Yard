"use client"

import { useEffect, useMemo, useState } from "react"
import { useRouter, useSearchParams } from "next/navigation"
import { apiPost } from "@/lib/useApi"
import { prewarmAppData } from "@/lib/client-cache"
import { Suspense } from "react"
import IOSInstallPrompt from "@/app/components/IOSInstallPrompt"
import { signalContentReady } from "@/app/components/BootGate"

function SignupForm() {
  const router = useRouter()

  useEffect(() => {
    signalContentReady()
  }, [])
  const searchParams = useSearchParams()
  const referralCode = searchParams.get("ref")?.trim() || searchParams.get("referralCode")?.trim() || ""
  const [email, setEmail] = useState("")
  const [password, setPassword] = useState("")
  const [showPassword, setShowPassword] = useState(false)
  const [cohortYear, setCohortYear] = useState("")
  const [program, setProgram] = useState("")
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState("")

  const admissionYears = useMemo(() => {
    const current = new Date().getFullYear() + 1
    return Array.from({ length: 12 }, (_, i) => current - i)
  }, [])

  async function handleSignup(e: React.FormEvent) {
    e.preventDefault()
    setLoading(true)
    setError("")

    if (!cohortYear) {
      setError("pick your admission year so we put you in the right class.")
      setLoading(false)
      return
    }
    if (!program.trim()) {
      setError("program is required (e.g. software engineering).")
      setLoading(false)
      return
    }

    try {
      await apiPost("/api/auth/signup", {
        email: email.trim(),
        password,
        cohortYear: Number(cohortYear),
        program: program.trim(),
        referralCode: referralCode || undefined,
      })
      
      // Token is set via httpOnly cookie by the API
      router.push("/feed")
      prewarmAppData()
      router.refresh()
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : "something went wrong. please try again.")
    } finally {
      setLoading(false)
    }
  }

  return (
    <main className="min-h-screen px-5 py-8 flex flex-col justify-center max-w-md mx-auto">
      <h1 className="text-4xl font-black mb-2">join yard</h1>
      <p className="text-white/60 mb-8">verify with your school email. post as your ghost.</p>
      {referralCode && (
        <p className="text-[#baff39] text-sm mb-4 bg-[#baff39]/10 border border-[#baff39]/20 rounded-lg px-3 py-2">
          🎉 invite code <span className="font-mono font-bold">{referralCode}</span> applied — your inviter will get credit.
        </p>
      )}

      <form onSubmit={handleSignup} className="space-y-4">
        <input
          className="input"
          type="email"
          placeholder="school email"
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          required
        />
        <div className="relative">
          <input
            className="input pr-16"
            type={showPassword ? "text" : "password"}
            placeholder="password (8+ chars, upper, lower, symbol)"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            required
            minLength={8}
            autoComplete="new-password"
          />
          <button
            type="button"
            onClick={() => setShowPassword((v) => !v)}
            aria-label={showPassword ? "hide password" : "show password"}
            aria-pressed={showPassword}
            className="absolute right-3 top-1/2 -translate-y-1/2 text-sm font-semibold text-white/50 hover:text-white"
          >
            {showPassword ? "hide" : "show"}
          </button>
        </div>
        <select
          className="input"
          value={cohortYear}
          onChange={(e) => setCohortYear(e.target.value)}
          required
          aria-label="admission year"
        >
          <option value="" disabled>admission year (e.g. 2025)</option>
          {admissionYears.map((year) => (
            <option key={year} value={year}>{year}</option>
          ))}
        </select>
        <input
          className="input"
          type="text"
          placeholder="program (e.g. software engineering)"
          value={program}
          onChange={(e) => setProgram(e.target.value)}
          required
        />

        {error && <p className="text-red-400 text-sm bg-red-400/10 border border-red-400/20 rounded-lg px-3 py-2">{error}</p>}

        <button className="btn-primary w-full" type="submit" disabled={loading}>
          {loading ? "creating account..." : "sign up"}
        </button>
      </form>

      <div className="mt-6 p-4 rounded-xl border border-[#baff39]/20 bg-[#baff39]/[0.04]">
        <h3 className="font-bold text-white mb-1 flex items-center gap-2">📲 iphone users — get the app</h3>
        <p className="text-sm text-white/60 mb-3">yard works best from your home screen. no app store needed:</p>
        <ol className="text-sm text-white/70 space-y-1.5">
          <li><span className="font-bold text-[#baff39]">1.</span> tap the <span className="font-semibold text-white">share</span> button in safari (square with arrow ↑)</li>
          <li><span className="font-bold text-[#baff39]">2.</span> scroll down and tap <span className="font-semibold text-white">“add to home screen”</span></li>
          <li><span className="font-bold text-[#baff39]">3.</span> tap <span className="font-semibold text-white">“add”</span> — yard opens full-screen like a native app</li>
        </ol>
      </div>

      <div className="mt-6 p-4 rounded-xl border border-white/10 bg-white/[0.03]">
        <h3 className="font-bold text-white mb-2 flex items-center gap-2">📜 community rules</h3>
        <ul className="text-sm text-white/70 space-y-1.5 pl-5 list-disc">
          <li>confessions, gossip, opinions, jokes, roasts — all allowed</li>
          <li>no direct threats of violence against real people</li>
          <li>no doxxing — sharing real names, addresses, phone numbers without consent</li>
          <li>no child sexual abuse material in any form</li>
          <li>no content facilitating illegal acts (drug sales, crime coordination)</li>
        </ul>
        <p className="text-xs text-white/40 mt-3">reported posts are hidden immediately and reviewed by admins. repeated violations lead to suspension or permanent ban.</p>
        <a href="/guidelines" className="text-[#baff39] text-sm font-semibold underline mt-2 inline-block">read full guidelines →</a>
      </div>

      <p className="text-center text-white/40 text-sm mt-5">
        already have an account?{" "}
        <a href="/login" className="text-white font-semibold">
          log in
        </a>
      </p>
      <p className="text-center text-white/40 text-sm mt-4">
        need the android app?{" "}
        <a href="/download" className="text-[#baff39] font-semibold">
          download yard
        </a>
      </p>
      <p className="text-center text-white/30 text-xs mt-4 px-4">
        by signing up you agree to our{" "}
        <a href="/terms" className="underline">terms</a>,{" "}
        <a href="/privacy" className="underline">privacy policy</a>,{" "}
        <a href="/guidelines" className="underline">community guidelines</a>, and{" "}
        <a href="/child-safety" className="underline">child safety</a>.
      </p>
      <IOSInstallPrompt />
    </main>
  )
}

export default function SignupPage() {
  return (
    <Suspense fallback={<main className="min-h-screen px-5 py-8 flex flex-col justify-center max-w-md mx-auto"><p className="text-white/40">loading...</p></main>}>
      <SignupForm />
    </Suspense>
  )
}