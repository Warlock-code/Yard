export default function TermsPage() {
  return (
    <main className="min-h-screen max-w-lg mx-auto px-5 py-8 pb-24">
      <h1 className="text-2xl font-black mb-1">terms of service</h1>
      <p className="text-white/40 text-xs mb-6">last updated: september 2026</p>

      <div className="space-y-5 text-sm text-white/80 leading-relaxed">
        <section>
          <h2 className="font-semibold text-white mb-1">eligibility</h2>
          <p>yard is for verified students only, using a valid school email. you must be at least 18 years old to create an account.</p>
        </section>
        <section>
          <h2 className="font-semibold text-white mb-1">your content</h2>
          <p>you own what you post. by posting, you allow yard to display it to other verified users on your campus per your chosen visibility setting. you&apos;re responsible for what you post.</p>
        </section>
        <section>
          <h2 className="font-semibold text-white mb-1">prohibited content</h2>
          <p>no threats of violence, doxxing (sharing someone&apos;s real identity, address, or contact info without consent), child sexual abuse material, or content facilitating illegal activity. everything else — opinions, criticism, jokes, drama — is allowed. see our community guidelines for detail.</p>
        </section>
        <section>
          <h2 className="font-semibold text-white mb-1">payments and subscriptions</h2>
          <p>plus and prime are recurring subscriptions billed via paystack. boosts, cosmetics, and other one-time purchases are non-refundable once delivered. prime members earn credits from engagement. cash payouts to MoMo/bank are currently paused — balances remain saved and payouts will reopen once compliance review is complete.</p>
        </section>
        <section>
          <h2 className="font-semibold text-white mb-1">account actions</h2>
          <p>we may remove content or suspend accounts that violate these terms or our community guidelines, including after a user report and review.</p>
        </section>
        <section>
          <h2 className="font-semibold text-white mb-1">changes</h2>
          <p>we may update these terms as yard evolves. continued use after changes means you accept the updated terms.</p>
        </section>
        <section>
          <h2 className="font-semibold text-white mb-1">contact</h2>
          <p>for questions, reach us at support@yardapp.me.</p>
        </section>
      </div>
    </main>
  )
}