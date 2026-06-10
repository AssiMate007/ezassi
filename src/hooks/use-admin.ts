import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";

// Your admin email — shield tab appears immediately for this account
const ADMIN_EMAIL = "assimate007@gmail.com";

export function useIsAdmin() {
  const [isAdmin, setIsAdmin] = useState(false);

  useEffect(() => {
    let cancelled = false;

    async function check() {
      const { data: { session } } = await supabase.auth.getSession();
      if (!session?.user || cancelled) return;

      // Primary check: email match (instant, no DB needed)
      if (session.user.email === ADMIN_EMAIL) {
        if (!cancelled) setIsAdmin(true);
        return;
      }

      // Secondary check: user_roles table (for future multi-admin)
      const { data } = await supabase
        .from("user_roles")
        .select("role")
        .eq("user_id", session.user.id)
        .eq("role", "admin")
        .maybeSingle();
      if (!cancelled) setIsAdmin(!!data);
    }

    check();

    const { data: { subscription } } = supabase.auth.onAuthStateChange((_e, session) => {
      if (!session?.user) {
        if (!cancelled) setIsAdmin(false);
        return;
      }
      // Email check first — instant
      if (session.user.email === ADMIN_EMAIL) {
        if (!cancelled) setIsAdmin(true);
        return;
      }
      // DB check for non-owner admins
      supabase
        .from("user_roles")
        .select("role")
        .eq("user_id", session.user.id)
        .eq("role", "admin")
        .maybeSingle()
        .then(({ data }) => {
          if (!cancelled) setIsAdmin(!!data);
        });
    });

    return () => {
      cancelled = true;
      subscription.unsubscribe();
    };
  }, []);

  return isAdmin;
}
