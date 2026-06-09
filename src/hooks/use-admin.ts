import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "./use-auth";

export function useIsAdmin() {
  const { user, loading } = useAuth();

  const { data, isLoading } = useQuery({
    queryKey: ["is-admin", user?.id],
    // FIX: wait until auth is no longer loading before querying
    enabled: !!user && !loading,
    staleTime: 1000 * 60 * 5, // cache for 5 min
    queryFn: async () => {
      // Double-check: query user_roles with RLS
      const { data, error } = await supabase
        .from("user_roles")
        .select("role")
        .eq("user_id", user!.id)
        .eq("role", "admin")
        .maybeSingle();
      if (error) {
        console.error("Admin check error:", error.message);
        return false;
      }
      return !!data;
    },
  });

  // Return false while still loading — never flash admin UI
  if (loading || isLoading) return false;
  return !!data;
}
