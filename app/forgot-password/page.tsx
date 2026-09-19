"use client"

import { useState } from "react"
import { useRouter } from "next/navigation"
import Link from "next/link"
import { apiPost } from "@/lib/useApi"

export default function ForgotPasswordPage() {
  const router = useRouter()
  const [email, setEmail] = useState("")
  const [loading, setLoading] = useState(false)
  const [message, setMessage] = useState("")
  const [error, setError] = useState("")

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    setLoading(true)
    setError("")
    setMessage("")

    try {
      const data = await apiPost("/api/auth/forgot-password", { email })
      setMessage(data.message || "If the email exists, a reset link has been sent.")
      if (data.emailFailed) {
        setError("Could not send email. Please try again or contact support.")
      } else {
        setTimeout(() => router.push("/login"), 3000)
      }
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : "Something went wrong.")
    } finally {
      setLoading(false)
    }
  }

  return (
    <main className="min-h-screen px-5 py-8 flex flex-col justify-center max-w-md mx-auto">
      <h1 className="text-4xl font-black mb-2">Reset password</h1>
      <p className="text-white/60 mb-8">Enter your school email to get a reset link.</p>

      <form onSubmit={handleSubmit} className="space-y-4">
        <input
          className="input"
          type="email"
          placeholder="School email"
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          required
        />

        {error && <p className="text-red-400 text-sm">{error}</p>}
        {message && !error && <p className="text-[#baff39] text-sm">{message}</p>}

        <button className="btn-primary w-full" type="submit" disabled={loading}>
          {loading ? "Sending..." : "Send reset link"}
        </button>
      </form>

      <p className="text-center text-white/40 text-sm mt-5">
        Remember your password?{" "}
        <Link href="/login" className="text-white font-semibold">
          Log in
        </Link>
      </p>
    </main>
  )
}