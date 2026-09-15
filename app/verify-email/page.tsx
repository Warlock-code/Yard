"use client"

import { Suspense, useState } from "react"
import { useRouter, useSearchParams } from "next/navigation"
import { apiPost } from "@/lib/useApi"

function VerifyContent() {
  const router = useRouter()
  const searchParams = useSearchParams()
  const userId = searchParams.get("userId") || ""

  const [code, setCode] = useState("")
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState("")

  async function handleVerify(e: React.FormEvent) {
    e.preventDefault()
    setLoading(true)
    setError("")

    try {
      await apiPost("/api/auth/verify-email", { userId, code })
      router.push("/feed")
    } catch (err: any) {
      setError(err.message)
    } finally {
      setLoading(false)
    }
  }

  return (
    <main className="min-h-screen px-5 py-8 flex flex-col justify-center max-w-md mx-auto">
      <h1 className="text-4xl font-black mb-2">Check your email</h1>
      <p className="text-white/60 mb-8">Enter the 6-digit code we sent you.</p>
      <p className="text-white/30 text-xs text-center mt-6">
        Check your school inbox — GCTU students, log into your Outlook mailbox.
      </p>
      
      <form onSubmit={handleVerify} className="space-y-4">
        <input
          className="input text-center text-2xl tracking-widest"
          type="text"
          maxLength={6}
          placeholder="000000"
          value={code}
          onChange={(e) => setCode(e.target.value)}
          required
        />

        {error && <p className="text-red-400 text-sm">{error}</p>}

        <button className="btn-primary w-full" type="submit" disabled={loading}>
          {loading ? "Verifying..." : "Verify"}
        </button>
      </form>
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