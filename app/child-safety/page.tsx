export default function ChildSafetyPage() {
  return (
    <main className="min-h-screen max-w-lg mx-auto px-5 py-8 pb-24">
      <h1 className="text-2xl font-black mb-1">child safety</h1>
      <p className="text-white/40 text-xs mb-6">last updated: september 2026</p>

      <div className="space-y-5 text-sm text-white/80 leading-relaxed">
        <section>
          <p>yard is restricted to verified university students aged 18 and over, using an active school email address. we do not knowingly permit anyone under 18 to create an account.</p>
        </section>
        <section>
          <h2 className="font-semibold text-white mb-1">zero tolerance</h2>
          <p>yard has zero tolerance for child sexual abuse material (csam) or any content that endangers minors. any such content is removed immediately upon detection and reported to the national center for missing & exploited children (ncmec) and relevant law enforcement, and the responsible account is permanently banned.</p>
        </section>
        <section>
          <h2 className="font-semibold text-white mb-1">reporting</h2>
          <p>if you encounter content that endangers a child, use the report button on the post immediately, or contact us directly at safety@yardapp.me. reports of this nature are reviewed as an urgent priority.</p>
        </section>
        <section>
          <h2 className="font-semibold text-white mb-1">our process</h2>
          <p>every report is triaged, and reported content is hidden from public view immediately while under review. confirmed violations result in content removal, account termination, and referral to appropriate authorities.</p>
        </section>
      </div>
    </main>
  )
}