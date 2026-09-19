"use client"

import { Suspense, useState } from "react"
import { useRouter, useSearchParams } from "next/navigation"
import { apiPost } from "@/lib/useApi"

function VerifyContent() {
  const router = useRouter()
  const searchParams = useSearchParams()
  const userId = searchParams.get("userId") || ""
  const emailFailed = searchParams.get("emailFailed") === "1"

  const [code, setCode] = useState("")
  const [loading, setLoading] = useState(false)
  const [resending, setResending] = useState(false)
  const [error, setError] = useState("")
  const [info, setInfo] = useState("")
  const [cooldown, setCooldown] = useState(0)

  async function handleVerify(e: React.FormEvent) {
    e.preventDefault()
    const clean = code.trim().replace(/\s+/g, "")
    if (!userId) {
      setError("Missing account. Please sign up again.")
      return
    }
    if (clean.length !== 6 || !/^\d{6}$/.test(clean)) {
      setError("Enter the 6-digit code from your email.")
      return
    }
    setLoading(true)
    setError("")
    setInfo("")

    try {
      await apiPost("/api/auth/verify-email", { userId, code: clean })
      router.push("/feed")
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : "Something went wrong. Please try again.")
    } finally {
      setLoading(false)
    }
  }

  async function handleResend() {
    if (!userId) {
      setError("No account found to resend to. Please sign up again.")
      return
    }
    if (cooldown > 0) return
    setResending(true)
    setError("")
    setInfo("")
    try {
      await apiPost("/api/auth/resend-code", { userId })
      setInfo("New code sent - check your inbox (and spam).")
      setCooldown(60)
      const interval = setInterval(() => {
        setCooldown((c) => {
          if (c <= 1) {
            clearInterval(interval)
            return 0
          }
          return c - 1
        })
      }, 1000)
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : "Failed to resend. Try again.")
    } finally {
      setResending(false)
    }
  }

  return (
    <main className="min-h-screen px-5 py-8 flex flex-col justify-center max-w-md mx-auto">
      <h1 className="text-4xl font-black mb-2">Check your email</h1>
      <p className="text-white/60 mb-2">Enter the 6-digit code we sent you.</p>
      {emailFailed && (
        <p className="text-amber-400 text-sm mb-4 bg-amber-400/10 border border-amber-400/20 rounded-lg px-3 py-2">
          We could not send the first email automatically. Tap <span className="font-semibold">Resend code</span> below to get a fresh code.
        </p>
      )}
      {!userId && (
        <p className="text-amber-400 text-sm mb-4 bg-amber-400/10 border border-amber-400/20 rounded-lg px-3 py-2">
          No account ID found. <a href="/signup" className="underline font-semibold">Sign up again</a> or check your email link.
        </p>
      )}
      <p className="text-white/30 text-xs text-center mb-6">
        Check your school inbox - GCTU students, log into your Outlook mailbox. Also check spam/junk.
      </p>

      <form onSubmit={handleVerify} className="space-y-4">
        <input
          className="input text-center text-2xl tracking-widest"
          type="text"
          inputMode="numeric"
          autoComplete="one-time-code"
          maxLength={6}
          placeholder="000000"
          value={code}
          onChange={(e) => setCode(e.target.value.replace(/\D/g, "").slice(0, 6))}
          required
        />

        {error && <p className="text-red-400 text-sm bg-red-400/10 border border-red-400/20 rounded-lg px-3 py-2">{error}</p>}
        {info && <p className="text-emerald-400 text-sm bg-emerald-400/10 border border-emerald-400/20 rounded-lg px-3 py-2">{info}</p>}

        <button className="btn-primary w-full" type="submit" disabled={loading || !userId}>
          {loading ? "Verifying..." : "Verify"}
        </button>
      </form>

      <div className="mt-4 flex flex-col gap-2">
        <button
          type="button"
          onClick={handleResend}
          disabled={resending || cooldown > 0 || !userId}
          className="w-full py-2.5 rounded-xl border border-white/10 text-white/70 hover:text-white hover:border-[#baff39]/30 text-sm font-medium disabled:opacity-40 disabled:cursor-not-allowed transition-colors"
        >
          {resending ? "Sending..." : cooldown > 0 ? `Resend in ${cooldown}s` : "Resend code"}
        </button>
        <p className="text-center text-white/30 text-xs">
          Didn&apos;t get it? Wait 1-2 minutes, check spam, then tap Resend.
        </p>
      </div>

      <p className="text-center text-white/30 text-xs mt-6">
        <a href="/signup" className="underline hover:text-white/60">Back to signup</a> | <a href="/login" className="underline hover:text-white/60">Log in</a>
      </p>
    </main>
  )
}

export default function VerifyEmailPage() {
  return (
    <Suspense>
      <VerifyContent />
    </Suspense>
  )
}