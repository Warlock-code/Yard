"use client"

import { useRouter } from "next/navigation"

export default function WelcomePage() {
  const router = useRouter()

  function handleContinue() {
    document.cookie = "yard_seen_welcome=1; path=/; max-age=" + 60 * 60 * 24 * 365
    router.push("/signup")
  }

  return (
    <main className="min-h-screen flex flex-col justify-center px-6 max-w-md mx-auto">
      <h1 className="text-3xl font-black mb-2">Welcome to Yard<span className="text-[#baff39]">.</span></h1>
      <p className="text-white/60 text-sm mb-6">Your campus whisper network.</p>

      <div className="space-y-4 text-sm text-white/80 mb-8">
        <div>
          <p className="font-semibold text-white mb-1">👻 You post as a ghost</p>
          <p>No real name, no real photo. Just your anonymous identity, verified once with your school email.</p>
        </div>
        <div>
          <p className="font-semibold text-white mb-1">✉️ Verifying is simple</p>
          <p>Sign up with your school email. Then check your school&apos;s inbox (GCTU students: log into your Outlook mailbox) for a 6-digit code.</p>
        </div>
        <div>
          <p className="font-semibold text-white mb-1">⚖️ The rules</p>
          <p>Say what you want — roast, joke, confess, argue. Just no threats, no doxxing, no CSAM. Everything else is fair game.</p>
        </div>
      </div>

      <button className="btn-primary w-full" onClick={handleContinue}>
        Get Started
      </button>
      <a
        href="/download"
        className="block text-center text-[#baff39] text-sm font-semibold mt-4"
      >
        Download the Android app
      </a>
    </main>
  )
}