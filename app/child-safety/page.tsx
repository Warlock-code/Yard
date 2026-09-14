export default function ChildSafetyPage() {
  return (
    <main className="min-h-screen max-w-lg mx-auto px-5 py-8 pb-24">
      <h1 className="text-2xl font-black mb-1">Child Safety</h1>
      <p className="text-white/40 text-xs mb-6">Last updated: September 2026</p>

      <div className="space-y-5 text-sm text-white/80 leading-relaxed">
        <section>
          <p>Yard is restricted to verified university students aged 18 and over, using an active school email address. We do not knowingly permit anyone under 18 to create an account.</p>
        </section>
        <section>
          <h2 className="font-semibold text-white mb-1">Zero tolerance</h2>
          <p>Yard has zero tolerance for child sexual abuse material (CSAM) or any content that endangers minors. Any such content is removed immediately upon detection and reported to the National Center for Missing & Exploited Children (NCMEC) and relevant law enforcement, and the responsible account is permanently banned.</p>
        </section>
        <section>
          <h2 className="font-semibold text-white mb-1">Reporting</h2>
          <p>If you encounter content that endangers a child, use the Report button on the post immediately, or contact us directly at safety@yardapp.me. Reports of this nature are reviewed as an urgent priority.</p>
        </section>
        <section>
          <h2 className="font-semibold text-white mb-1">Our process</h2>
          <p>Every report is triaged, and reported content is hidden from public view immediately while under review. Confirmed violations result in content removal, account termination, and referral to appropriate authorities.</p>
        </section>
      </div>
    </main>
  )
}