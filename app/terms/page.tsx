export default function TermsPage() {
  return (
    <main className="min-h-screen max-w-lg mx-auto px-5 py-8 pb-24">
      <h1 className="text-2xl font-black mb-1">Terms of Service</h1>
      <p className="text-white/40 text-xs mb-6">Last updated: September 2026</p>

      <div className="space-y-5 text-sm text-white/80 leading-relaxed">
        <section>
          <h2 className="font-semibold text-white mb-1">Eligibility</h2>
          <p>Yard is for verified students only, using a valid school email. You must be at least 18 years old to create an account.</p>
        </section>
        <section>
          <h2 className="font-semibold text-white mb-1">Your content</h2>
          <p>You own what you post. By posting, you allow Yard to display it to other verified users on your campus per your chosen visibility setting. You're responsible for what you post.</p>
        </section>
        <section>
          <h2 className="font-semibold text-white mb-1">Prohibited content</h2>
          <p>No threats of violence, doxxing (sharing someone's real identity, address, or contact info without consent), child sexual abuse material, or content facilitating illegal activity. Everything else — opinions, criticism, jokes, drama — is allowed. See our Community Guidelines for detail.</p>
        </section>
        <section>
          <h2 className="font-semibold text-white mb-1">Payments and subscriptions</h2>
          <p>Plus and Prime are recurring subscriptions billed via Paystack. Boosts, cosmetics, and other one-time purchases are non-refundable once delivered. Prime earnings are paid out at our discretion following admin review, subject to a minimum payout threshold.</p>
        </section>
        <section>
          <h2 className="font-semibold text-white mb-1">Account actions</h2>
          <p>We may remove content or suspend accounts that violate these terms or our Community Guidelines, including after a user report and review.</p>
        </section>
        <section>
          <h2 className="font-semibold text-white mb-1">Changes</h2>
          <p>We may update these terms as Yard evolves. Continued use after changes means you accept the updated terms.</p>
        </section>
        <section>
          <h2 className="font-semibold text-white mb-1">Contact</h2>
          <p>For questions, reach us at support@yardapp.me.</p>
        </section>
      </div>
    </main>
  )
}