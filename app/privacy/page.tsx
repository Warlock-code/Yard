export default function PrivacyPage() {
  return (
    <main className="min-h-screen max-w-lg mx-auto px-5 py-8 pb-24">
      <h1 className="text-2xl font-black mb-1">privacy policy</h1>
      <p className="text-white/40 text-xs mb-6">last updated: september 2026</p>

      <div className="space-y-5 text-sm text-white/80 leading-relaxed">
        <section>
          <h2 className="font-semibold text-white mb-1">what we collect</h2>
          <p>we collect your school email (for verification only), a hashed password, your campus and program, and the content you post. your school email is never shown publicly and is never linked to your posts in any way visible to other users.</p>
        </section>
        <section>
          <h2 className="font-semibold text-white mb-1">anonymity</h2>
          <p>your posts appear under your ghost identity, not your real name or email. internally, posts are linked to your account so we can enforce our community guidelines and respond to legal requests, but this link is never exposed to other users.</p>
        </section>
        <section>
          <h2 className="font-semibold text-white mb-1">payments</h2>
          <p>payments are processed by paystack. we do not store your card details — paystack handles checkout directly and shares only transaction status with us. we never collect bank or MoMo account details: yard offers no cash payouts of any kind.</p>
        </section>
        <section>
          <h2 className="font-semibold text-white mb-1">push notifications</h2>
          <p>if you enable push notifications, we store a device token (fcm token or web push subscription) linked to your account to deliver notifications. you can disable this at any time in your device settings or by logging out.</p>
        </section>
        <section>
          <h2 className="font-semibold text-white mb-1">ai content processing</h2>
          <p>uploaded images are scanned by openrouter (using anthropic claude) for nudity, graphic violence, and csam before posting. reported content may also be reviewed by the same ai. no human at yard or openrouter views your images unless a report escalates to admin review.</p>
        </section>
        <section>
          <h2 className="font-semibold text-white mb-1">image storage</h2>
          <p>images are hosted by uploadthing. we track your storage usage against your quota (50 mb default, upgradable). unposted uploads are kept for 7 days then auto-deleted.</p>
        </section>
        <section>
          <h2 className="font-semibold text-white mb-1">cookies</h2>
          <p>we use two httponly cookies: <code>yard_token</code> (30-day session) and <code>yard_seen_welcome</code> (1-year preference). no third-party analytics or tracking cookies are set.</p>
        </section>
        <section>
          <h2 className="font-semibold text-white mb-1">data retention</h2>
          <p>we retain account and post data for as long as your account is active. you can delete your account from the lair page (requires password confirmation). deletion removes all your posts, votes, comments, earnings, uploads, and device tokens immediately.</p>
        </section>
        <section>
          <h2 className="font-semibold text-white mb-1">public profile scope</h2>
          <p>your ghost id, avatar emoji, campus, tier badge, streak, post count, and follower/following counts are visible to other users. your email, password, program, level, storage are never public.</p>
        </section>
        <section>
          <h2 className="font-semibold text-white mb-1">third parties</h2>
          <p>we use resend (email delivery), uploadthing (image storage), paystack (payments), openrouter (ai moderation), and vercel/neon (hosting and database). each processes only the data necessary for their function.</p>
        </section>
        <section>
          <h2 className="font-semibold text-white mb-1">contact</h2>
          <p>questions about your data? reach us at the email listed on our terms page.</p>
        </section>
      </div>
    </main>
  )
}