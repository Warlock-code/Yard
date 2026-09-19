"use client"

import { useState } from "react"
import { useRouter, useSearchParams } from "next/navigation"
import { apiPost } from "@/lib/useApi"
import { Suspense } from "react"

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
      }) as { userId: string; emailFailed?: boolean }
      const suffix = data.emailFailed ? "&emailFailed=1" : ""
      router.push(`/verify-email?userId=${data.userId}${suffix}`)
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