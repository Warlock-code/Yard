"use client"

import { Suspense, useEffect, useState } from "react"
import { useRouter, useSearchParams } from "next/navigation"
import Link from "next/link"
import { apiPost } from "@/lib/useApi"

function ResetPasswordContent() {
  const router = useRouter()
  const searchParams = useSearchParams()
  const token = searchParams.get("token")

  const [password, setPassword] = useState("")
  const [confirmPassword, setConfirmPassword] = useState("")
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState("")
  const [message, setMessage] = useState("")
  const [tokenValid, setTokenValid] = useState(true)

  useEffect(() => {
    if (!token) {
      setTokenValid(false)
      setError("Invalid or missing reset token.")
    }
  }, [token])

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    if (!token) return
    if (password !== confirmPassword) {
      setError("Passwords do not match.")
      return
    }
    setLoading(true)
    setError("")
    setMessage("")

    try {
      const data = await apiPost("/api/auth/reset-password", { token, password })
      setMessage(data.message || "Password reset successful.")
      setTimeout(() => router.push("/login"), 3000)
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : "Something went wrong.")
    } finally {
      setLoading(false)
    }
  }

  if (!tokenValid) {
    return (
      <main className="min-h-screen px-5 py-8 flex flex-col justify-center max-w-md mx-auto text-center">
        <p className="text-3xl mb-3">🔗</p>
        <h1 className="text-2xl font-bold mb-2">Invalid reset link</h1>
        <p className="text-white/60 mb-6">This link is invalid or has expired.</p>
        <Link href="/forgot-password" className="btn-primary inline-block">
          Request a new link
        </Link>
      </main>
    )
  }

  return (
    <main className="min-h-screen px-5 py-8 flex flex-col justify-center max-w-md mx-auto">
      <h1 className="text-4xl font-black mb-2">New password</h1>
      <p className="text-white/60 mb-8">Enter your new password below.</p>

      <form onSubmit={handleSubmit} className="space-y-4">
        <input
          className="input"
          type="password"
          placeholder="New password (min 8 chars, upper, lower, number, symbol)"
          value={password}
          onChange={(e) => setPassword(e.target.value)}
          required
          autoComplete="new-password"
        />
        <input
          className="input"
          type="password"
          placeholder="Confirm new password"
          value={confirmPassword}
          onChange={(e) => setConfirmPassword(e.target.value)}
          required
          autoComplete="new-password"
        />

        {error && <p className="text-red-400 text-sm">{error}</p>}
        {message && !error && <p className="text-[#baff39] text-sm">{message}</p>}

        <button className="btn-primary w-full" type="submit" disabled={loading}>
          {loading ? "Resetting..." : "Reset password"}
        </button>
      </form>

      <p className="text-center text-white/40 text-sm mt-5">
        <Link href="/login" className="text-white font-semibold">
          Back to login
        </Link>
      </p>
    </main>
  )
}

export default function ResetPasswordPage() {
  return (
    <Suspense fallback={<div className="min-h-screen flex items-center justify-center"><p className="text-white/40">Loading...</p></div>}>
      <ResetPasswordContent />
    </Suspense>
  )
}