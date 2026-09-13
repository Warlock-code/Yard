"use client"

import { useState } from "react"
import { useRouter } from "next/navigation"
import { apiPost } from "@/lib/useApi"

export default function LoginPage() {
  const router = useRouter()
  const [email, setEmail] = useState("")
  const [password, setPassword] = useState("")
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState("")

  async function handleLogin(e: React.FormEvent) {
    e.preventDefault()
    setLoading(true)
    setError("")

    try {
      await apiPost("/api/auth/login", { email, password })
      router.push("/feed")
    } catch (err: any) {
      setError(err.message)
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

        {error && <p className="text-red-400 text-sm">{error}</p>}

                <button className="btn-primary w-full" type="submit" disabled={loading}>
          {loading ? "Logging in..." : "Log in"}
        </button>
      </form>

      <p className="text-center text-white/40 text-sm mt-5">
        New here?{" "}
        <a href="/signup" className="text-white font-semibold">
          Create an account
        </a>
      </p>
    </main>
  )
}