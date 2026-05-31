import { createFileRoute } from "@tanstack/react-router";

export const Route = createFileRoute("/_legal/privacy")({
  head: () => ({
    meta: [
      { title: "Privacy Policy — AssiMate" },
      { name: "description", content: "What data AssiMate collects and how we protect it." },
    ],
  }),
  component: PrivacyPage,
});

function PrivacyPage() {
  return (
    <article className="max-w-none">
      <h1 className="text-3xl font-bold mb-2">Privacy Policy</h1>
      <p className="text-sm text-muted-foreground">Last updated: {new Date().toLocaleDateString()}</p>

      <h2 className="mt-8 text-xl font-semibold">What we collect</h2>
      <ul className="mt-2 list-disc pl-5 space-y-1">
        <li>Account info: email, display name, role (student/writer).</li>
        <li>Profile: avatar, bio, rating, jobs completed.</li>
        <li>Assignment & chat data you post on the platform.</li>
        <li>Payment metadata (handled by our payment provider — we never store full card numbers).</li>
      </ul>

      <h2 className="mt-6 text-xl font-semibold">How we use it</h2>
      <p className="mt-2">To run the marketplace: showing assignments, routing bids, enabling chat, processing payments, and keeping the platform safe from abuse.</p>

      <h2 className="mt-6 text-xl font-semibold">Sharing</h2>
      <p className="mt-2">Profile info (name, rating, bio) is visible to other authenticated users. Assignment titles and budgets are visible to writers. Chat messages are visible only to the two participants. We don't sell your data.</p>

      <h2 className="mt-6 text-xl font-semibold">Security</h2>
      <p className="mt-2">Data is stored on encrypted infrastructure. Access is gated by row-level security policies so users can only read and write rows they're allowed to.</p>

      <h2 className="mt-6 text-xl font-semibold">Your rights</h2>
      <p className="mt-2">You can edit your profile or delete your account at any time. Email us to request a copy or full deletion of your data.</p>

      <h2 className="mt-6 text-xl font-semibold">Contact</h2>
      <p className="mt-2"><a href="/contact" className="underline">Get in touch</a> for any privacy questions.</p>
    </article>
  );
}
