import { createFileRoute } from "@tanstack/react-router";

export const Route = createFileRoute("/_legal/terms")({
  head: () => ({
    meta: [
      { title: "Terms of Service — AssiMate" },
      { name: "description", content: "The rules for using AssiMate as a student or writer." },
    ],
  }),
  component: TermsPage,
});

function TermsPage() {
  return (
    <article className="prose prose-sm max-w-none">
      <h1 className="text-3xl font-bold mb-2">Terms of Service</h1>
      <p className="text-sm text-muted-foreground">Last updated: {new Date().toLocaleDateString()}</p>

      <h2 className="mt-8 text-xl font-semibold">1. Who we are</h2>
      <p className="mt-2">AssiMate ("we", "us") is an online marketplace that connects students with independent writers ("mates") for assignment help, tutoring, and study support.</p>

      <h2 className="mt-6 text-xl font-semibold">2. Eligibility</h2>
      <p className="mt-2">You must be at least 13 years old (or the minimum digital-consent age in your country) to use AssiMate. Users under 18 confirm they have parental permission.</p>

      <h2 className="mt-6 text-xl font-semibold">3. Academic integrity</h2>
      <p className="mt-2">AssiMate is intended for reference, tutoring, and learning support. You are responsible for using delivered work in accordance with your school's academic integrity rules. Submitting purchased work as your own may violate those rules.</p>

      <h2 className="mt-6 text-xl font-semibold">4. Bids, payments & 15% service fee</h2>
      <p className="mt-2">When a student accepts a bid, the agreed amount is charged via our payment provider. AssiMate retains a <strong>15% service fee</strong> on every successful transaction. The remaining 85% is paid out to the writer after the assignment is marked complete.</p>

      <h2 className="mt-6 text-xl font-semibold">5. User conduct</h2>
      <p className="mt-2">You agree not to harass other users, post illegal content, attempt to bypass the platform's payment flow, or impersonate anyone.</p>

      <h2 className="mt-6 text-xl font-semibold">6. Termination</h2>
      <p className="mt-2">We may suspend or remove accounts that violate these Terms or our community guidelines.</p>

      <h2 className="mt-6 text-xl font-semibold">7. Disclaimer</h2>
      <p className="mt-2">AssiMate is provided "as is" without warranties of any kind. We are not liable for the quality of work delivered by independent writers — bid reviews and ratings are there to help you choose.</p>

      <h2 className="mt-6 text-xl font-semibold">8. Changes</h2>
      <p className="mt-2">We may update these Terms. Continued use after changes means you accept the updated version.</p>

      <h2 className="mt-6 text-xl font-semibold">9. Contact</h2>
      <p className="mt-2">Questions? <a href="/contact" className="underline">Reach out here</a>.</p>
    </article>
  );
}
