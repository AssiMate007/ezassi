import { createFileRoute, redirect } from "@tanstack/react-router";
import { useEffect } from "react";
import { useNavigate } from "@tanstack/react-router";
import { supabase } from "@/integrations/supabase/client";

export const Route = createFileRoute("/")({
  beforeLoad: async () => {
    if (typeof window === "undefined") return;
    const { data } = await supabase.auth.getSession();
    throw redirect({ to: data.session ? "/feed" : "/auth" });
  },
  component: IndexRedirect,
});

function IndexRedirect() {
  const navigate = useNavigate();
  useEffect(() => {
    (async () => {
      const { data } = await supabase.auth.getSession();
      navigate({ to: data.session ? "/feed" : "/auth", replace: true });
    })();
  }, [navigate]);
  return (
    <div className="min-h-screen flex items-center justify-center bg-gradient-soft">
      <div className="animate-pulse text-muted-foreground text-sm">Loading…</div>
    </div>
  );
}
