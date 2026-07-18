import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";

// Admin status is determined server-side via the user_roles table.
// No email is hardcoded in the client bundle.
export function useIsAdmin() {
  const [isAdmin, setIsAdmin] = useState(false);

  useEffect(() => {
    let cancelled = false;

    const check = async (userId: string | null | undefined) => {
      if (!userId) {
        if (!cancelled) setIsAdmin(false);
        return;
      }
      const { data } = await supabase
        .from("user_roles")
        .select("role")
        .eq("user_id", userId)
        .eq("role", "admin")
        .maybeSingle();
      if (!cancelled) setIsAdmin(!!data);
    };

    supabase.auth.getSession().then(({ data: { session } }) => {
      check(session?.user?.id);
    });

    const { data: { subscription } } = supabase.auth.onAuthStateChange((_e, session) => {
      check(session?.user?.id);
    });

    return () => {
      cancelled = true;
      subscription.unsubscribe();
    };
  }, []);

  return isAdmin;
}
