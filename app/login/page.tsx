"use client"

import { useState } from "react"
import { useRouter } from "next/navigation"
import Link from "next/link"


export default function LoginPage() {
  const router = useRouter()
  const [email, setEmail] = useState("")
  const [password, setPassword] = useState("")
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
          throw new Error(data.error || "Verify your email first.")
        }
        throw new Error(data.error || "Something went wrong.")
      }
      router.push("/feed")
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : "Something went wrong.")
    } finally {
      setLoading(false)
    }
  }

  return (
    <main className="min-h-screen px-5 py-8 flex flex-col justify-center max-w-md mx-auto">
      <h1 className="text-4xl font-black mb-2">Welcome back</h1>
      <p className="text-white/60 mb-8">Log in as your ghost.</p>

      <form onSubmit={handleLogin} className="space-y-4">
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
          placeholder="Password"
          value={password}
          onChange={(e) => setPassword(e.target.value)}
          required
        />

        {error && (
          <div className="text-red-400 text-sm bg-red-400/10 border border-red-400/20 rounded-lg px-3 py-2">
            <p>{error}</p>
            {verifyUserId && (
              <Link href={`/verify-email?userId=${verifyUserId}`} className="text-white underline font-semibold mt-1 inline-block">
                Verify email →
              </Link>
            )}
          </div>
        )}

        <Link
          href="/forgot-password"
          className="text-sm text-white/60 hover:text-white underline self-end mr-2"
        >
          Forgot password?
        </Link>

        <button className="btn-primary w-full" type="submit" disabled={loading}>
          {loading ? "Logging in..." : "Log in"}
        </button>
      </form>

      <p className="text-center text-white/40 text-sm mt-5">
        New here?{" "}
        <Link href="/signup" className="text-white font-semibold">
          Create an account
        </Link>
      </p>
    </main>
  )
}