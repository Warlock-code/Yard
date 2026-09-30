"use client"

import { useState } from "react"
import { useRouter, useSearchParams } from "next/navigation"
import { apiPost } from "@/lib/useApi"
import { prewarmAppData } from "@/lib/client-cache"
import { Suspense } from "react"
import IOSInstallPrompt from "@/app/components/IOSInstallPrompt"

function SignupForm() {
  const router = useRouter()
  const searchParams = useSearchParams()
  const referralCode = searchParams.get("ref")?.trim() || searchParams.get("referralCode")?.trim() || ""
  const [email, setEmail] = useState("")
  const [password, setPassword] = useState("")
  const [programLevel, setProgramLevel] = useState("")
  const [program, setProgram] = useState("")
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState("")

  async function handleSignup(e: React.FormEvent) {
    e.preventDefault()
    setLoading(true)
    setError("")

    if (!programLevel.trim()) {
      setError("program level is required (e.g. level 200).")
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
        programLevel: programLevel.trim(),
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
        <input
          className="input"
          type="password"
          placeholder="password (8+ chars, upper, lower, symbol)"
          value={password}
          onChange={(e) => setPassword(e.target.value)}
          required
          minLength={8}
        />
        <input
          className="input"
          type="text"
          placeholder="program level (e.g. level 200)"
          value={programLevel}
          onChange={(e) => setProgramLevel(e.target.value)}
          required
        />
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
        <a href="/privacy" className="underline">privacy policy</a>, and{" "}
        <a href="/guidelines" className="underline">community guidelines</a>.
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