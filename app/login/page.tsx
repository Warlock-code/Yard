"use client"

import { useEffect, useState } from "react"
import { useRouter } from "next/navigation"
import Link from "next/link"
import { prewarmAppData } from "@/lib/client-cache"
import { signalContentReady } from "@/app/components/BootGate"


export default function LoginPage() {
  const router = useRouter()

  useEffect(() => {
    signalContentReady()
  }, [])
  const [email, setEmail] = useState("")
  const [password, setPassword] = useState("")
  const [showPassword, setShowPassword] = useState(false)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState("")

  const [verifyUserId, setVerifyUserId] = useState<string | null>(null)

  async function handleLogin(e: React.FormEvent) {
    e.preventDefault()
    setLoading(true)
    setError("")
    setVerifyUserId(null)

    try {
      // Use direct fetch to capture userId on verify-required response
      const res = await fetch("/api/auth/login", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email, password }),
        credentials: "include",
      })
      const data = await res.json().catch(() => ({}))
      if (!res.ok) {
        if (res.status === 403 && data.userId) {
          setVerifyUserId(data.userId)
          throw new Error(data.error || "verify your email first.")
        }
        throw new Error(data.error || "something went wrong.")
      }
      router.push("/feed")
      // Warm feed + me in background so /feed opens instantly
      prewarmAppData()
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : "something went wrong.")
    } finally {
      setLoading(false)
    }
  }

  return (
    <main className="min-h-screen px-5 py-8 flex flex-col justify-center max-w-md mx-auto">
      <h1 className="text-4xl font-black mb-2">welcome back</h1>
      <p className="text-white/60 mb-8">log in as your ghost.</p>

      <form onSubmit={handleLogin} className="space-y-4">
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
            placeholder="password"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            required
            autoComplete="current-password"
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

        {error && (
          <div className="text-red-400 text-sm bg-red-400/10 border border-red-400/20 rounded-lg px-3 py-2">
            <p>{error}</p>
            {verifyUserId && (
              <Link href={`/verify-email?userId=${verifyUserId}`} className="text-white underline font-semibold mt-1 inline-block">
                verify email →
              </Link>
            )}
          </div>
        )}

        <Link
          href="/forgot-password"
          className="text-sm text-white/60 hover:text-white underline self-end mr-2"
        >
          forgot password?
        </Link>

        <button className="btn-primary w-full" type="submit" disabled={loading}>
          {loading ? "logging in..." : "log in"}
        </button>
      </form>

      <p className="text-center text-white/40 text-sm mt-5">
        new here?{" "}
        <Link href="/signup" className="text-white font-semibold">
          create an account
        </Link>
      </p>
    </main>
  )
}