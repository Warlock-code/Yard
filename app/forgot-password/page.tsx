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
      const data = await apiPost<{ message?: string; emailFailed?: boolean }>("/api/auth/forgot-password", { email })
      setMessage(data.message || "if the email exists, a reset link has been sent.")
      if (data.emailFailed) {
        setError("could not send email. please try again or contact support.")
      } else {
        setTimeout(() => router.push("/login"), 3000)
      }
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : "something went wrong.")
    } finally {
      setLoading(false)
    }
  }

  return (
    <main className="min-h-screen px-5 py-8 flex flex-col justify-center max-w-md mx-auto">
      <h1 className="text-4xl font-black mb-2">reset password</h1>
      <p className="text-white/60 mb-8">enter your school email to get a reset link.</p>

      <form onSubmit={handleSubmit} className="space-y-4">
        <input
          className="input"
          type="email"
          placeholder="school email"
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          required
        />

        {error && <p className="text-red-400 text-sm">{error}</p>}
        {message && !error && <p className="text-[#baff39] text-sm">{message}</p>}

        <button className="btn-primary w-full" type="submit" disabled={loading}>
          {loading ? "sending..." : "send reset link"}
        </button>
      </form>

      <p className="text-center text-white/40 text-sm mt-5">
        remember your password?{" "}
        <Link href="/login" className="text-white font-semibold">
          log in
        </Link>
      </p>
    </main>
  )
}