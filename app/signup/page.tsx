"use client"

import { useState } from "react"
import { useRouter, useSearchParams } from "next/navigation"
import { apiPost } from "@/lib/useApi"
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
      setError("Program level is required (e.g. Level 200).")
      setLoading(false)
      return
    }
    if (!program.trim()) {
      setError("Program is required (e.g. Software Engineering).")
      setLoading(false)
      return
    }

    try {
      const data = await apiPost("/api/auth/signup", {
        email: email.trim(),
        password,
        programLevel: programLevel.trim(),
        program: program.trim(),
        referralCode: referralCode || undefined,
      }) as { userId: string; ghostId: string; token?: string }
      
      // Token is set via httpOnly cookie by the API
      router.push("/feed")
      router.refresh()
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : "Something went wrong. Please try again.")
    } finally {
      setLoading(false)
    }
  }

  return (
    <main className="min-h-screen px-5 py-8 flex flex-col justify-center max-w-md mx-auto">
      <h1 className="text-4xl font-black mb-2">Join Yard</h1>
      <p className="text-white/60 mb-8">Verify with your school email. Post as your ghost.</p>
      {referralCode && (
        <p className="text-[#baff39] text-sm mb-4 bg-[#baff39]/10 border border-[#baff39]/20 rounded-lg px-3 py-2">
          🎉 Invite code <span className="font-mono font-bold">{referralCode}</span> applied — your inviter will get credit.
        </p>
      )}

      <form onSubmit={handleSignup} className="space-y-4">
        <input
          className="input"
          type="email"
          placeholder="School email"
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          required
        />
        <input
          className="input"
          type="password"
          placeholder="Password (8+ chars, upper, lower, symbol)"
          value={password}
          onChange={(e) => setPassword(e.target.value)}
          required
          minLength={8}
        />
        <input
          className="input"
          type="text"
          placeholder="Program level (e.g. Level 200)"
          value={programLevel}
          onChange={(e) => setProgramLevel(e.target.value)}
          required
        />
        <input
          className="input"
          type="text"
          placeholder="Program (e.g. Software Engineering)"
          value={program}
          onChange={(e) => setProgram(e.target.value)}
          required
        />

        {error && <p className="text-red-400 text-sm bg-red-400/10 border border-red-400/20 rounded-lg px-3 py-2">{error}</p>}

        <button className="btn-primary w-full" type="submit" disabled={loading}>
          {loading ? "Creating account..." : "Sign up"}
        </button>
      </form>

      <div className="mt-6 p-4 rounded-xl border border-[#baff39]/20 bg-[#baff39]/[0.04]">
        <h3 className="font-bold text-white mb-1 flex items-center gap-2">📲 iPhone users — get the app</h3>
        <p className="text-sm text-white/60 mb-3">Yard works best from your Home Screen. No App Store needed:</p>
        <ol className="text-sm text-white/70 space-y-1.5">
          <li><span className="font-bold text-[#baff39]">1.</span> Tap the <span className="font-semibold text-white">Share</span> button in Safari (square with arrow ↑)</li>
          <li><span className="font-bold text-[#baff39]">2.</span> Scroll down and tap <span className="font-semibold text-white">“Add to Home Screen”</span></li>
          <li><span className="font-bold text-[#baff39]">3.</span> Tap <span className="font-semibold text-white">“Add”</span> — Yard opens full-screen like a native app</li>
        </ol>
      </div>

      <div className="mt-6 p-4 rounded-xl border border-white/10 bg-white/[0.03]">
        <h3 className="font-bold text-white mb-2 flex items-center gap-2">📜 Community Rules</h3>
        <ul className="text-sm text-white/70 space-y-1.5 pl-5 list-disc">
          <li>Confessions, gossip, opinions, jokes, roasts — all allowed</li>
          <li>No direct threats of violence against real people</li>
          <li>No doxxing — sharing real names, addresses, phone numbers without consent</li>
          <li>No child sexual abuse material in any form</li>
          <li>No content facilitating illegal acts (drug sales, crime coordination)</li>
        </ul>
        <p className="text-xs text-white/40 mt-3">Reported posts are hidden immediately and reviewed by admins. Repeated violations lead to suspension or permanent ban.</p>
        <a href="/guidelines" className="text-[#baff39] text-sm font-semibold underline mt-2 inline-block">Read full guidelines →</a>
      </div>

      <p className="text-center text-white/40 text-sm mt-5">
        Already have an account?{" "}
        <a href="/login" className="text-white font-semibold">
          Log in
        </a>
      </p>
      <p className="text-center text-white/40 text-sm mt-4">
        Need the Android app?{" "}
        <a href="/download" className="text-[#baff39] font-semibold">
          Download Yard
        </a>
      </p>
      <p className="text-center text-white/30 text-xs mt-4 px-4">
        By signing up you agree to our{" "}
        <a href="/terms" className="underline">Terms</a>,{" "}
        <a href="/privacy" className="underline">Privacy Policy</a>, and{" "}
        <a href="/guidelines" className="underline">Community Guidelines</a>.
      </p>
      <IOSInstallPrompt />
    </main>
  )
}

export default function SignupPage() {
  return (
    <Suspense fallback={<main className="min-h-screen px-5 py-8 flex flex-col justify-center max-w-md mx-auto"><p className="text-white/40">Loading...</p></main>}>
      <SignupForm />
    </Suspense>
  )
}