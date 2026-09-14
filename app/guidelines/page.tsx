export default function GuidelinesPage() {
  return (
    <main className="min-h-screen max-w-lg mx-auto px-5 py-8 pb-24">
      <h1 className="text-2xl font-black mb-1">Community Guidelines</h1>
      <p className="text-white/40 text-xs mb-6">Free speech, with limits that keep it legal.</p>

      <div className="space-y-5 text-sm text-white/80 leading-relaxed">
        <section>
          <h2 className="font-semibold text-white mb-1">What's allowed</h2>
          <p>Confessions, gossip, opinions, jokes, roasts, disagreements, criticism — including of people, programs, or the school itself. Yard doesn't moderate based on being offensive, unpopular, or harsh.</p>
        </section>
        <section>
          <h2 className="font-semibold text-white mb-1">What's not allowed</h2>
          <ul className="list-disc pl-5 space-y-1">
            <li>Direct threats of violence against a real person</li>
            <li>Doxxing — sharing someone's real name, address, phone number, or other identifying info without consent, when tied to their anonymous ghost identity</li>
            <li>Child sexual abuse material in any form</li>
            <li>Content facilitating an illegal act (e.g. selling drugs, coordinating a crime)</li>
          </ul>
        </section>
        <section>
          <h2 className="font-semibold text-white mb-1">How reports work</h2>
          <p>Any post can be reported. Reported posts are hidden from public view immediately and reviewed by an admin, assisted by an AI first-pass check. Reports are either dismissed (post restored) or actioned (post permanently removed).</p>
        </section>
        <section>
          <h2 className="font-semibold text-white mb-1">Repeated violations</h2>
          <p>Accounts with repeated confirmed violations may be suspended or permanently banned.</p>
        </section>
      </div>
    </main>
  )
}