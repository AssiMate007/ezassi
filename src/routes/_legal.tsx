import { createFileRoute, Outlet, Link } from "@tanstack/react-router";
import { Sparkles, ArrowLeft } from "lucide-react";

export const Route = createFileRoute("/_legal")({
  component: LegalLayout,
});

function LegalLayout() {
  return (
    <div className="min-h-screen bg-gradient-soft">
      <header className="sticky top-0 z-30 bg-card/85 backdrop-blur-lg border-b border-border">
        <div className="mx-auto max-w-2xl px-4 h-14 flex items-center justify-between">
          <Link to="/feed" className="flex items-center gap-1.5 text-sm font-medium text-muted-foreground hover:text-foreground">
            <ArrowLeft className="h-4 w-4" /> Back
          </Link>
          <Link to="/feed" className="flex items-center gap-1.5 font-bold">
            <Sparkles className="h-4 w-4 text-primary" />
            <span className="text-gradient">AssiMate</span>
          </Link>
          <span className="w-12" />
        </div>
      </header>
      <main className="mx-auto max-w-2xl px-5 py-8">
        <Outlet />
      </main>
      <footer className="mx-auto max-w-2xl px-5 pb-10 pt-6 border-t border-border mt-8 text-xs text-muted-foreground flex flex-wrap gap-x-4 gap-y-2 justify-center">
        <Link to="/terms" className="hover:text-foreground">Terms</Link>
        <Link to="/privacy" className="hover:text-foreground">Privacy</Link>
        <Link to="/refund" className="hover:text-foreground">Refunds</Link>
        <Link to="/about" className="hover:text-foreground">About</Link>
        <Link to="/contact" className="hover:text-foreground">Contact</Link>
        <span>© {new Date().getFullYear()} AssiMate</span>
      </footer>
    </div>
  );
}
