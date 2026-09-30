export default function GuidelinesPage() {
  return (
    <main className="min-h-screen max-w-lg mx-auto px-5 py-8 pb-24">
      <h1 className="text-2xl font-black mb-1">community guidelines</h1>
      <p className="text-white/40 text-xs mb-6">free speech, with limits that keep it legal.</p>

      <div className="space-y-5 text-sm text-white/80 leading-relaxed">
        <section>
          <h2 className="font-semibold text-white mb-1">what&apos;s allowed</h2>
          <p>confessions, gossip, opinions, jokes, roasts, disagreements, criticism — including of people, programs, or the school itself. yard doesn&apos;t moderate based on being offensive, unpopular, or harsh.</p>
        </section>
        <section>
          <h2 className="font-semibold text-white mb-1">what&apos;s not allowed</h2>
          <ul className="list-disc pl-5 space-y-1">
            <li>direct threats of violence against a real person</li>
            <li>doxxing — sharing someone&apos;s real name, address, phone number, or other identifying info without consent, when tied to their anonymous ghost identity</li>
            <li>child sexual abuse material in any form</li>
            <li>content facilitating an illegal act (e.g. selling drugs, coordinating a crime)</li>
          </ul>
        </section>
        <section>
          <h2 className="font-semibold text-white mb-1">how reports work</h2>
          <p>any post can be reported. reported posts are hidden from public view immediately and reviewed by an admin, assisted by an ai first-pass check. reports are either dismissed (post restored) or actioned (post permanently removed).</p>
        </section>
        <section>
          <h2 className="font-semibold text-white mb-1">repeated violations</h2>
          <p>accounts with repeated confirmed violations may be suspended or permanently banned.</p>
        </section>
      </div>
    </main>
  )
}