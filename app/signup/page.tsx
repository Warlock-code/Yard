"use client"

import { useState } from "react"
import { useRouter } from "next/navigation"
import { apiPost } from "@/lib/useApi"

export default function SignupPage() {
  const router = useRouter()
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

    try {
      const data = await apiPost("/api/auth/signup", { email, password, programLevel, program })
      router.push(`/verify-email?userId=${data.userId}`)
    } catch (err: any) {
      setError(err.message)
    } finally {
      setLoading(false)
    }
  }

  return (
    <main className="min-h-screen px-5 py-8 flex flex-col justify-center max-w-md mx-auto">
      <h1 className="text-4xl font-black mb-2">Join Yard</h1>
      <p className="text-white/60 mb-8">Verify with your school email. Post as your ghost.</p>

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
          placeholder="Password"
          value={password}
          onChange={(e) => setPassword(e.target.value)}
          required
        />
        <input
          className="input"
          type="text"
          placeholder="Program level (e.g. Level 200)"
          value={programLevel}
          onChange={(e) => setProgramLevel(e.target.value)}
        />
        <input
          className="input"
          type="text"
          placeholder="Program (e.g. Software Engineering)"
          value={program}
          onChange={(e) => setProgram(e.target.value)}
        />

        {error && <p className="text-red-400 text-sm">{error}</p>}

        <button className="btn-primary w-full" type="submit" disabled={loading}>
          {loading ? "Creating account..." : "Sign up"}
        </button>
      </form>
    </main>
  )
}