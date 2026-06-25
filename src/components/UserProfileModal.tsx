import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useIsAdmin } from "@/hooks/use-admin";
import { X, Star, GraduationCap, PenLine, Wallet, Shield, CheckCircle2 } from "lucide-react";
import { useEffect, useState } from "react";

interface UserProfileModalProps {
  isOpen: boolean;
  onClose: () => void;
  userId: string | null;
}

function InitialsAvatar({ name, size = 64 }: { name: string; size?: number }) {
  const initials = name.split(" ").map((w) => w[0]).slice(0, 2).join("").toUpperCase();
  const colors = ["bg-violet-500", "bg-fuchsia-500", "bg-pink-500", "bg-indigo-500", "bg-cyan-500", "bg-emerald-500"];
  const color = colors[name.charCodeAt(0) % colors.length];
  return (
    <div className={`${color} rounded-2xl flex items-center justify-center font-bold text-white shrink-0 shadow-md`}
      style={{ width: size, height: size, fontSize: size * 0.34 }}>
      {initials}
    </div>
  );
}

export function UserProfileModal({ isOpen, onClose, userId }: UserProfileModalProps) {
  const isAdmin = useIsAdmin();
  const [targetIsAdmin, setTargetIsAdmin] = useState(false);

  useEffect(() => {
    if (isOpen) {
      document.body.style.overflow = "hidden";
    } else {
      document.body.style.overflow = "unset";
    }
    return () => {
      document.body.style.overflow = "unset";
    };
  }, [isOpen]);

  const { data: targetProfile, isLoading } = useQuery({
    queryKey: ["public-profile", userId],
    enabled: isOpen && !!userId,
    queryFn: async () => {
      const { data, error } = await supabase
        .from("profiles")
        .select("*")
        .eq("id", userId!)
        .single();
      if (error) throw error;

      // Check if target user is also an admin
      const { data: roleData } = await supabase
        .from("user_roles")
        .select("role")
        .eq("user_id", userId!)
        .eq("role", "admin")
        .maybeSingle();
      setTargetIsAdmin(!!roleData);

      return data;
    },
  });

  if (!isOpen || !userId) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
      {/* Backdrop */}
      <div 
        className="absolute inset-0 bg-zinc-950/60 backdrop-blur-sm transition-opacity"
        onClick={onClose}
      />

      {/* Content Container */}
      <div className="relative w-full max-w-sm rounded-3xl border border-zinc-200 bg-white p-6 shadow-2xl dark:border-zinc-800 dark:bg-zinc-900 animate-in fade-in zoom-in-95 duration-150">
        {/* Close Button */}
        <button
          onClick={onClose}
          className="absolute right-4 top-4 rounded-full p-1.5 text-zinc-400 hover:bg-zinc-100 hover:text-zinc-700 dark:hover:bg-zinc-800 dark:hover:text-zinc-200 transition"
        >
          <X className="h-4 w-4" />
        </button>

        {isLoading ? (
          <div className="py-12 flex flex-col items-center justify-center space-y-3">
            <div className="h-16 w-16 rounded-2xl bg-zinc-100 dark:bg-zinc-800 animate-pulse" />
            <div className="h-4 w-32 rounded bg-zinc-100 dark:bg-zinc-800 animate-pulse" />
            <div className="h-3 w-20 rounded bg-zinc-100 dark:bg-zinc-800 animate-pulse" />
          </div>
        ) : targetProfile ? (
          <div className="space-y-5">
            {/* Header / Avatar */}
            <div className="flex flex-col items-center text-center space-y-2 pt-2">
              <InitialsAvatar name={targetProfile.display_name} size={64} />
              <div>
                <h3 className="text-lg font-bold text-zinc-900 dark:text-zinc-50">
                  {targetProfile.display_name}
                </h3>
                <div className="mt-1 flex items-center justify-center gap-1.5 text-xs text-zinc-500 dark:text-zinc-400">
                  {targetProfile.role === "student" ? (
                    <GraduationCap className="h-3.5 w-3.5 text-indigo-500" />
                  ) : (
                    <PenLine className="h-3.5 w-3.5 text-violet-500" />
                  )}
                  <span className="capitalize font-medium">{targetProfile.role}</span>
                  {targetIsAdmin && (
                    <>
                      <span className="text-zinc-300 dark:text-zinc-700">•</span>
                      <span className="inline-flex items-center gap-1 text-indigo-600 dark:text-indigo-400 font-semibold">
                        <Shield className="h-3 w-3" />Admin
                      </span>
                    </>
                  )}
                </div>
              </div>
            </div>

            {/* Stats Grid */}
            <div className="grid grid-cols-2 gap-3 rounded-2xl bg-zinc-50 p-4 dark:bg-zinc-800/50">
              <div className="text-center">
                <div className="flex items-center justify-center gap-1 text-base font-bold text-zinc-900 dark:text-zinc-50">
                  <Star className="h-4 w-4 fill-amber-400 text-amber-400" />
                  {Number(targetProfile.rating).toFixed(1)}
                </div>
                <p className="text-[10px] text-zinc-500 dark:text-zinc-400 mt-0.5 uppercase tracking-wider font-semibold">Rating</p>
              </div>
              <div className="text-center border-l border-zinc-200 dark:border-zinc-800">
                <div className="text-base font-bold text-zinc-900 dark:text-zinc-50">
                  {targetProfile.jobs_completed}
                </div>
                <p className="text-[10px] text-zinc-500 dark:text-zinc-400 mt-0.5 uppercase tracking-wider font-semibold">
                  {targetProfile.role === "student" ? "Assignments" : "Jobs completed"}
                </p>
              </div>
            </div>

            {/* Bio */}
            {targetProfile.bio ? (
              <div className="space-y-1.5">
                <h4 className="text-[10px] font-bold uppercase tracking-wider text-zinc-400 dark:text-zinc-500">About</h4>
                <p className="text-xs text-zinc-600 dark:text-zinc-400 leading-relaxed bg-zinc-50/50 dark:bg-zinc-800/20 p-3 rounded-xl border border-zinc-100 dark:border-zinc-800/40">
                  {targetProfile.bio}
                </p>
              </div>
            ) : (
              <p className="text-xs text-center text-zinc-400 dark:text-zinc-500 italic py-1">No bio added yet</p>
            )}

            {/* Admin-only: View UPI ID */}
            {isAdmin && (
              <div className="space-y-1.5 border-t border-zinc-100 pt-4 dark:border-zinc-800">
                <div className="flex items-center gap-1.5 text-[10px] font-bold uppercase tracking-wider text-indigo-600 dark:text-indigo-400">
                  <Wallet className="h-3.5 w-3.5" />
                  <span>Admin Panel: UPI Details</span>
                </div>
                {targetProfile.upi_id ? (
                  <div className="flex items-center justify-between rounded-xl bg-indigo-50/50 p-3 border border-indigo-100 dark:bg-indigo-950/20 dark:border-indigo-900/40">
                    <span className="font-mono text-xs font-semibold text-indigo-700 dark:text-indigo-300">
                      {targetProfile.upi_id}
                    </span>
                    <span className="inline-flex h-2 w-2 rounded-full bg-emerald-500" />
                  </div>
                ) : (
                  <p className="text-xs text-zinc-400 dark:text-zinc-500 italic">No UPI ID saved by this user</p>
                )}
              </div>
            )}
          </div>
        ) : (
          <div className="py-8 text-center text-zinc-400 text-sm">
            Failed to load profile.
          </div>
        )}
      </div>
    </div>
  );
}
