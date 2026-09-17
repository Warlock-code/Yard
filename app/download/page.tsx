export default function DownloadPage() {
  return (
    <main className="min-h-screen max-w-lg mx-auto px-6 py-10 flex flex-col items-center text-center">
      <h1 className="text-3xl font-black mb-2">
        Get Yard<span className="text-[#baff39]">.</span>
      </h1>
      <p className="text-white/50 text-sm mb-8">Your campus whisper network. Android only, for now.</p>

      <a
        className="btn-primary px-8 py-3 text-base mb-8"
        href="https://github.com/Warlock-code/Yard/releases/download/v1.0.0/Yard-v1.0.0.apk"
      >
        Download for Android
      </a>

      <div className="text-left w-full space-y-4 text-sm text-white/70">
        <div>
          <p className="font-semibold text-white mb-1">1. Download the file</p>
          <p>Tap the button above. Your phone may warn you it&apos;s an unknown file — that&apos;s normal for apps outside the Play Store.</p>
        </div>
        <div>
          <p className="font-semibold text-white mb-1">2. Allow the install</p>
          <p>When you open the downloaded file, Android will ask to &quot;allow installs from this source.&quot; Tap Settings → allow it, then go back and install.</p>
        </div>
        <div>
          <p className="font-semibold text-white mb-1">3. Sign up with your school email</p>
          <p>You&apos;ll need access to your school inbox to verify. GCTU students: check your Outlook mailbox for the code.</p>
        </div>
      </div>
    </main>
  )
}