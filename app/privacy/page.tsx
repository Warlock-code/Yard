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
          <h2 className="font-semibold text-white mb-1">Payments & banking</h2>
          <p>Payments are processed by Paystack. We do not store your card or mobile money details — Paystack handles that directly and shares only transaction status with us. If you request a payout (Prime users only), we store your bank/MoMo account name, number, and code solely to process the transfer via Paystack. This data is encrypted at rest and deleted after the payout is paid.</p>
        </section>
        <section>
          <h2 className="font-semibold text-white mb-1">Push notifications</h2>
          <p>If you enable push notifications, we store a device token (FCM token or Web Push subscription) linked to your account to deliver notifications. You can disable this at any time in your device settings or by logging out.</p>
        </section>
        <section>
          <h2 className="font-semibold text-white mb-1">AI content processing</h2>
          <p>Uploaded images are scanned by OpenRouter (using Anthropic Claude) for nudity, graphic violence, and CSAM before posting. Reported content may also be reviewed by the same AI. No human at Yard or OpenRouter views your images unless a report escalates to admin review.</p>
        </section>
        <section>
          <h2 className="font-semibold text-white mb-1">Image storage</h2>
          <p>Images are hosted by UploadThing. We track your storage usage against your quota (50 MB default, upgradable). Unposted uploads are kept for 7 days then auto-deleted.</p>
        </section>
        <section>
          <h2 className="font-semibold text-white mb-1">Cookies</h2>
          <p>We use two httpOnly cookies: <code>yard_token</code> (30-day session) and <code>yard_seen_welcome</code> (1-year preference). No third-party analytics or tracking cookies are set.</p>
        </section>
        <section>
          <h2 className="font-semibold text-white mb-1">Data retention</h2>
          <p>We retain account and post data for as long as your account is active. You can delete your account from the Lair page (requires password confirmation). Deletion removes all your posts, votes, comments, earnings, uploads, and device tokens immediately.</p>
        </section>
        <section>
          <h2 className="font-semibold text-white mb-1">Public profile scope</h2>
          <p>Your ghost ID, avatar emoji, campus, tier badge, streak, post count, and follower/following counts are visible to other users. Your email, password, program, level, earnings, storage, and payout details are never public.</p>
        </section>
        <section>
          <h2 className="font-semibold text-white mb-1">Third parties</h2>
          <p>We use Resend (email delivery), UploadThing (image storage), Paystack (payments), OpenRouter (AI moderation), and Vercel/Neon (hosting and database). Each processes only the data necessary for their function.</p>
        </section>
        <section>
          <h2 className="font-semibold text-white mb-1">Contact</h2>
          <p>Questions about your data? Reach us at the email listed on our Terms page.</p>
        </section>
      </div>
    </main>
  )
}