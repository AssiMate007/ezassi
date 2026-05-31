import { createFileRoute } from "@tanstack/react-router";

export const Route = createFileRoute("/_legal/refund")({
  head: () => ({
    meta: [
      { title: "Refund Policy — AssiMate" },
      { name: "description", content: "When and how refunds work on AssiMate." },
    ],
  }),
  component: RefundPage,
});

function RefundPage() {
  return (
    <article>
      <h1 className="text-3xl font-bold mb-2">Refund Policy</h1>
      <p className="text-sm text-muted-foreground">Last updated: {new Date().toLocaleDateString()}</p>

      <h2 className="mt-8 text-xl font-semibold">Full refund</h2>
      <p className="mt-2">If a writer fails to deliver before the deadline, you can request a full refund within 48 hours of the missed deadline.</p>

      <h2 className="mt-6 text-xl font-semibold">Partial refund</h2>
      <p className="mt-2">If the delivered work clearly does not match the assignment brief, you can open a dispute. Our team reviews the chat history, brief, and delivery, and may issue a partial refund.</p>

      <h2 className="mt-6 text-xl font-semibold">No refund</h2>
      <p className="mt-2">Once you have marked an assignment as completed and rated the writer, the payment is final.</p>

      <h2 className="mt-6 text-xl font-semibold">Service fee</h2>
      <p className="mt-2">The 15% AssiMate service fee is refunded along with the writer's portion on approved full refunds.</p>

      <h2 className="mt-6 text-xl font-semibold">How to request</h2>
      <p className="mt-2">Open the assignment, tap "Report a problem", and our team responds within 2 business days.</p>
    </article>
  );
}
