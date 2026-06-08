import { createFileRoute } from "@tanstack/react-router";
import { Mail, MessageCircle, Instagram } from "lucide-react";

export const Route = createFileRoute("/_legal/contact")({
  head: () => ({
    meta: [
      { title: "Contact — AssiMate" },
      { name: "description", content: "Reach the AssiMate team for support, partnerships, or press." },
    ],
  }),
  component: ContactPage,
});

function ContactPage() {
  return (
    <article>
      <h1 className="text-3xl font-bold">Contact us</h1>
      <p className="mt-3 text-muted-foreground">We usually reply within a day. Pick whichever feels easier:</p>

      <div className="mt-6 space-y-3">
        <a href="mailto:hello@assimate.app" className="flex items-center gap-3 rounded-2xl bg-card border border-border p-4 shadow-card hover:shadow-glow transition">
          <Mail className="h-5 w-5 text-primary" />
          <div>
            <p className="font-semibold">hello@assimate.app</p>
            <p className="text-xs text-muted-foreground">General support & questions</p>
          </div>
        </a>
        <a href="mailto:safety@assimate.app" className="flex items-center gap-3 rounded-2xl bg-card border border-border p-4 shadow-card hover:shadow-glow transition">
          <MessageCircle className="h-5 w-5 text-primary" />
          <div>
            <p className="font-semibold">safety@assimate.app</p>
            <p className="text-xs text-muted-foreground">Report abuse or disputes</p>
          </div>
        </a>
        {/* FIX: Instagram link now points to actual profile, not homepage */}
        <a href="https://instagram.com/assimate" target="_blank" rel="noreferrer" className="flex items-center gap-3 rounded-2xl bg-card border border-border p-4 shadow-card hover:shadow-glow transition">
          <Instagram className="h-5 w-5 text-primary" />
          <div>
            <p className="font-semibold">@assimate</p>
            <p className="text-xs text-muted-foreground">DM us on Instagram</p>
          </div>
        </a>
      </div>
    </article>
  );
}
