import { useEffect, useSyncExternalStore } from "react";
import type { Session, User } from "@supabase/supabase-js";
import { supabase } from "@/integrations/supabase/client";

export interface Profile {
  id: string;
  display_name: string;
  role: "student" | "writer";
  avatar_url: string | null;
  bio: string | null;
  rating: number;
  jobs_completed: number;
  upi_id?: string | null;
  is_banned?: boolean;
}

type AuthState = {
  session: Session | null;
  user: User | null;
  profile: Profile | null;
  loading: boolean;
};

let state: AuthState = { session: null, user: null, profile: null, loading: true };
const listeners = new Set<() => void>();
let initialized = false;
let lastProfileFetchFor: string | null = null;

function setState(next: Partial<AuthState>) {
  state = { ...state, ...next };
  listeners.forEach((l) => l());
}

function fetchProfile(userId: string) {
  if (lastProfileFetchFor === userId) return;
  lastProfileFetchFor = userId;
  supabase
    .from("profiles")
    .select("*")
    .eq("id", userId)
    .single()
    .then(({ data }) => setState({ profile: (data as Profile | null) ?? null }));
}

function init() {
  if (initialized || typeof window === "undefined") return;
  initialized = true;

  supabase.auth.onAuthStateChange((_e, s) => {
    setState({ session: s, user: s?.user ?? null, loading: false });
    if (s?.user) {
      fetchProfile(s.user.id);
    } else {
      lastProfileFetchFor = null;
      setState({ profile: null });
    }
  });

  supabase.auth.getSession().then(({ data: { session: s } }) => {
    setState({ session: s, user: s?.user ?? null, loading: false });
    if (s?.user) fetchProfile(s.user.id);
  });
}

const subscribe = (cb: () => void) => {
  listeners.add(cb);
  return () => listeners.delete(cb);
};
const getSnapshot = () => state;
const getServerSnapshot = () => state;

export function useAuth() {
  useEffect(init, []);
  return useSyncExternalStore(subscribe, getSnapshot, getServerSnapshot);
}
