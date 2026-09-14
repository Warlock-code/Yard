export default function PrivacyPage() {
  return (
    <main className="min-h-screen max-w-lg mx-auto px-5 py-8 pb-24">
      <h1 className="text-2xl font-black mb-1">Privacy Policy</h1>
      <p className="text-white/40 text-xs mb-6">Last updated: September 2026</p>

      <div className="space-y-5 text-sm text-white/80 leading-relaxed">
        <section>
          <h2 className="font-semibold text-white mb-1">What we collect</h2>
          <p>We collect your school email (for verification only), a hashed password, your campus and program, and the content you post. Your school email is never shown publicly and is never linked to your posts in any way visible to other users.</p>
        </section>
        <section>
          <h2 className="font-semibold text-white mb-1">Anonymity</h2>
          <p>Your posts appear under your ghost identity, not your real name or email. Internally, posts are linked to your account so we can enforce our Community Guidelines and respond to legal requests, but this link is never exposed to other users.</p>
        </section>
        <section>
          <h2 className="font-semibold text-white mb-1">Payments</h2>
          <p>Payments are processed by Paystack. We do not store your card or mobile money details — Paystack handles that directly and shares only transaction status with us.</p>
        </section>
        <section>
          <h2 className="font-semibold text-white mb-1">Data retention</h2>
          <p>We retain account and post data for as long as your account is active. You can request account deletion at any time by contacting us.</p>
        </section>
        <section>
          <h2 className="font-semibold text-white mb-1">Third parties</h2>
          <p>We use Resend (email delivery), UploadThing (image storage), Paystack (payments), and Vercel/Neon (hosting and database). Each processes only the data necessary for their function.</p>
        </section>
        <section>
          <h2 className="font-semibold text-white mb-1">Contact</h2>
          <p>Questions about your data? Reach us at the email listed on our Terms page.</p>
        </section>
      </div>
    </main>
  )
}