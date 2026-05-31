import { createFileRoute } from "@tanstack/react-router";
import { Sparkles, Users, ShieldCheck, Wallet } from "lucide-react";

export const Route = createFileRoute("/_legal/about")({
  head: () => ({
    meta: [
      { title: "About — AssiMate" },
      { name: "description", content: "AssiMate is the friendly marketplace that pairs students with trusted assignment mates." },
    ],
  }),
  component: AboutPage,
});

function AboutPage() {
  return (
    <article>
      <h1 className="text-3xl font-bold">About AssiMate</h1>
      <p className="mt-3 text-muted-foreground">
        We believe getting help with your assignment shouldn't feel cold or sketchy.
        AssiMate is a warm, human marketplace that pairs students with writers who actually
        care — at a price you set.
      </p>

      <div className="grid sm:grid-cols-2 gap-4 mt-8">
        {[
          { Icon: Users, title: "Built for students", body: "Post in 30 seconds. Pick from real, rated mates." },
          { Icon: Wallet, title: "You set the budget", body: "Writers bid on your terms — no hidden upcharges." },
          { Icon: ShieldCheck, title: "Safe by design", body: "Encrypted chats, RLS-protected data, dispute support." },
          { Icon: Sparkles, title: "15% keeps us going", body: "A small service fee funds safety, support and improvements." },
        ].map(({ Icon, title, body }) => (
          <div key={title} className="rounded-2xl bg-card border border-border p-5 shadow-card">
            <Icon className="h-6 w-6 text-primary mb-2" />
            <h3 className="font-semibold">{title}</h3>
            <p className="text-sm text-muted-foreground mt-1">{body}</p>
          </div>
        ))}
      </div>
    </article>
  );
}
