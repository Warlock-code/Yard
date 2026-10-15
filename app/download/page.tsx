import { APP_VERSION } from "@/lib/appVersion"

const APK_URL = APP_VERSION.APK_URL
const QR_SRC = `https://api.qrserver.com/v1/create-qr-code/?size=180x180&data=${encodeURIComponent(APK_URL)}`

const SHOTS = [
  { label: "feed", desc: "every whisper on campus, live." },
  { label: "battles", desc: "vote your side. winner takes the yard." },
  { label: "lair", desc: "your ghost, your stats, your haunts." },
]

export default function DownloadPage() {
  return (
    <main className="min-h-screen max-w-lg mx-auto px-6 py-10 flex flex-col items-center text-center">
      <h1 className="text-3xl font-black mb-2">
        get yard<span className="text-[#baff39]">.</span>
      </h1>
      <p className="text-white/50 text-sm mb-8">your campus whisper network. android only, for now.</p>

      <a
        className="btn-primary px-8 py-3 text-base mb-2"
        href={APK_URL}
      >
        download for android
      </a>
      <p className="text-white/40 text-xs mb-8">
        v{APP_VERSION.ANDROID_LATEST_VERSION} (build {APP_VERSION.ANDROID_LATEST_BUILD}) • ~5.4 mb apk
      </p>

      <div className="card w-full p-5 mb-8 flex flex-col items-center gap-3">
        <img
          src={QR_SRC}
          alt="qr code linking to the yard android apk"
          width={180}
          height={180}
          loading="lazy"
          className="rounded-xl bg-white p-2"
        />
        <p className="text-white/50 text-xs">scan with your android camera to grab the apk.</p>
      </div>

      <div className="w-full mb-8">
        <p className="font-semibold text-white text-sm mb-3">peek inside</p>
        <div className="flex gap-3 overflow-x-auto pb-2 no-scrollbar">
          {SHOTS.map((shot) => (
            <div
              key={shot.label}
              className="card shrink-0 w-36 p-3 flex flex-col items-center gap-2"
            >
              <div
                aria-hidden="true"
                className="w-full aspect-[9/16] rounded-lg bg-white/10 border border-white/10"
              />
              <p className="font-semibold text-white text-xs">{shot.label}</p>
              <p className="text-white/40 text-[11px] leading-snug">{shot.desc}</p>
            </div>
          ))}
        </div>
      </div>

      <div className="text-left w-full space-y-4 text-sm text-white/70">
        <div>
          <p className="font-semibold text-white mb-1">1. download the file</p>
          <p>tap the button above. your phone may warn you it&apos;s an unknown file — that&apos;s normal for apps outside the play store.</p>
        </div>
        <div>
          <p className="font-semibold text-white mb-1">2. allow the install</p>
          <p>when you open the downloaded file, android will ask to &quot;allow installs from this source.&quot; tap settings → allow it, then go back and install.</p>
        </div>
        <div>
          <p className="font-semibold text-white mb-1">3. sign up with your school email</p>
          <p>you&apos;ll need access to your school inbox to verify. gctu students: check your outlook mailbox for the code.</p>
        </div>
      </div>

      <div className="card w-full mt-8 p-5 text-left">
        <p className="font-semibold text-white text-sm mb-1">on iphone? add to home screen</p>
        <p className="text-white/50 text-xs mb-4">the native app is android-only — but yard runs fine as a web app on ios.</p>
        <div className="flex gap-4 items-start">
          <div
            aria-hidden="true"
            className="shrink-0 w-16 rounded-2xl border border-white/10 bg-white/5 p-2 flex flex-col items-center gap-1"
          >
            <div className="w-10 h-10 rounded-xl bg-[#050505] border border-[#baff39]/40 flex items-center justify-center">
              <span className="text-[#baff39] text-lg font-black leading-none">y.</span>
            </div>
            <div className="w-8 h-8 rounded-lg bg-white/10 flex items-center justify-center">
              <span className="text-white/70 text-base leading-none">↑</span>
            </div>
          </div>
          <ol className="space-y-2 text-sm text-white/70 list-none">
            <li><span className="font-semibold text-white">1.</span> open yardapp.me in safari.</li>
            <li><span className="font-semibold text-white">2.</span> tap share (↑), then &quot;add to home screen&quot;.</li>
            <li><span className="font-semibold text-white">3.</span> open yard from your home screen + sign in.</li>
          </ol>
        </div>
      </div>
    </main>
  )
}
