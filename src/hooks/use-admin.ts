import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";

// Simple, standalone hook — no React Query cache issues
export function useIsAdmin() {
  const [isAdmin, setIsAdmin] = useState(false);

  useEffect(() => {
    let cancelled = false;

    async function check(userId: string) {
      const { data } = await supabase
        .from("user_roles")
        .select("role")
        .eq("user_id", userId)
        .eq("role", "admin")
        .maybeSingle();
      if (!cancelled) setIsAdmin(!!data);
    }

    // Check on mount if already signed in
    supabase.auth.getSession().then(({ data: { session } }) => {
      if (session?.user && !cancelled) check(session.user.id);
    });

    // Re-check whenever auth state changes
    const { data: { subscription } } = supabase.auth.onAuthStateChange((_e, session) => {
      if (session?.user) {
        check(session.user.id);
      } else {
        if (!cancelled) setIsAdmin(false);
      }
    });

    return () => {
      cancelled = true;
      subscription.unsubscribe();
    };
  }, []);

  return isAdmin;
}
