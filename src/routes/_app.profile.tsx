import { createFileRoute, useNavigate, Link } from "@tanstack/react-router";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/use-auth";
import { useTheme } from "@/hooks/use-theme";
import { useIsAdmin } from "@/hooks/use-admin";
import { 
  Star, LogOut, GraduationCap, PenLine, Wallet, 
  CheckCircle2, Eye, EyeOff, Shield, Sun, Moon, ChevronRight
} from "lucide-react";
import { AssignmentCard } from "@/components/AssignmentCard";
import { toast } from "sonner";

export const Route = createFileRoute("/_app/profile")({
  component: ProfilePage,
});

function Avatar({ name }: { name: string }) {
  const initials = name.split(" ").map((w) => w[0]).slice(0, 2).join("").toUpperCase();
  return (
    <div className="flex h-16 w-16 items-center justify-center rounded-full bg-zinc-900 text-base font-bold text-white dark:bg-zinc-50 dark:text-zinc-900">
      {initials || "??"}
    </div>
  );
}

function ProfilePage() {
  const { user, profile } = useAuth();
  const navigate = useNavigate();
  const isAdmin = useIsAdmin();
  const { theme, toggle: toggleTheme } = useTheme();
  const queryClient = useQueryClient();

  const [upiId, setUpiId] = useState("");
  const [showUpi, setShowUpi] = useState(false);

  // 1. Fetch UPI safely via isolated user_payment_settings table join
  const { data: paymentSettings, isLoading: loadingPayment } = useQuery({
    queryKey: ["payment-settings", user?.id],
    enabled: !!user,
    queryFn: async () => {
      const { data, error } = await supabase
        .from("user_payment_settings")
        .select("upi_id")
        .eq("user_id", user?.id)
        .maybeSingle();
      if (error) throw error;
      return data;
    }
  });

  useEffect(() => {
    if (paymentSettings?.upi_id) {
      setUpiId(paymentSettings.upi_id);
    }
  }, [paymentSettings]);

  // 2. Hardened Payment Settings Mutator Mutation
  const saveUpiMutation = useMutation({
    mutationFn: async (trimmedUpi: string) => {
      if (!user) return;
      const { error } = await supabase
        .from("user_payment_settings")
        .upsert({ 
          user_id: user.id, 
          upi_id: trimmedUpi || null 
        }, { onConflict: "user_id" });
      if (error) throw error;
    },
    onSuccess: () => {
      toast.success("Payment configurations securely locked ✓");
      queryClient.invalidateQueries({ queryKey: ["payment-settings", user?.id] });
    },
    onError: (error: any) => {
      toast.error(error.message);
    }
  });

  const handleSaveUpi = () => {
    const trimmed = upiId.trim();
    if (trimmed && !/^[\w.\-]{2,256}@[a-zA-Z]{2,64}$/.test(trimmed)) {
      return toast.error("Enter a valid UPI ID e.g. name@okhdfcbank");
    }
    saveUpiMutation.mutate(trimmed);
  };

  // 3. User Assignments / Bids Query Setup
  const { data: myAssignments, isLoading: loadingAssignments } = useQuery({
    queryKey: ["my-assignments", user?.id, profile?.role],
    enabled: !!profile,
    queryFn: async () => {
      if (!user || !profile) return [];
      if (profile.role === "student") {
        const { data } = await supabase
          .from("assignments")
          .select("*, bids(count)")
          .eq("student_id", user.id)
          .order("created_at", { ascending: false });
        return data ?? [];
      } else {
        const { data } = await supabase
          .from("bids")
          .select("*, assignment:assignments(*)")
          .eq("writer_id", user.id)
          .order("created_at", { ascending: false });
        return (data ?? []).map((b) => b.assignment).filter(Boolean);
      }
    },
  });

  const signOut = async () => {
    await supabase.auth.signOut();
    navigate({ to: "/auth" });
  };

  if (!profile) {
    return (
      <div className="mx-auto max-w-md p-6 space-y-4">
        <div className="h-20 w-20 rounded-full bg-zinc-100 animate-pulse dark:bg-zinc-900" />
        <div className="h-6 w-1/2 bg-zinc-100 animate-pulse rounded-md dark:bg-zinc-900" />
        <div className="h-4 w-1/3 bg-zinc-100 animate-pulse rounded-md dark:bg-zinc-900" />
      </div>
    );
  }

  const maskedUpi = paymentSettings?.upi_id
    ? paymentSettings.upi_id.replace(/^(.{3}).*(@.*)$/, (_, a, b) => `${a}${"•".repeat(6)}${b}`)
    : null;

  return (
    <div className="min-h-screen bg-white pb-32 dark:bg-zinc-950">
      
      {/* Account Profile Header Block */}
      <div className="border-b border-zinc-100 bg-zinc-50/40 px-4 pt-10 pb-6 dark:border-zinc-900 dark:bg-zinc-900/10">
        <div className="mx-auto max-w-md">
          <div className="flex items-center gap-4">
            <Avatar name={profile.display_name} />
            <div className="flex-1 min-w-0">
              <h1 className="text-lg font-bold tracking-tight text-zinc-900 dark:text-zinc-50 truncate">
                {profile.display_name}
              </h1>
              
              <div className="flex items-center gap-1.5 text-xs font-medium text-zinc-400 mt-0.5">
                {profile.role === "student" ? <GraduationCap className="h-3.5 w-3.5" /> : <PenLine className="h-3.5 w-3.5" />}
                <span className="capitalize">{profile.role}</span>
              </div>
            </div>

            {isAdmin && (
              <Link 
                to="/admin" 
                className="inline-flex items-center gap-1 rounded-full border border-zinc-200 bg-white px-2.5 py-1 text-[11px] font-bold text-zinc-700 shadow-sm dark:border-zinc-800 dark:bg-zinc-900 dark:text-zinc-300"
              >
                <Shield className="h-3 w-3 text-zinc-400" />
                <span>Admin</span>
              </Link>
            )}
          </div>

          {/* Flat Minimalist Data Counter Row */}
          <div className="mt-6 grid grid-cols-2 border-t border-zinc-100 pt-4 text-center dark:border-zinc-900">
            <div>
              <p className="text-base font-bold text-zinc-900 dark:text-zinc-50">
                <Star className="inline h-3.5 w-3.5 fill-current mr-0.5 mb-0.5" />
                {Number(profile.rating || 5.0).toFixed(1)}
              </p>
              <p className="text-[10px] font-bold text-zinc-400 uppercase tracking-wider mt-0.5 dark:text-zinc-500">Rating</p>
            </div>
            <div className="border-l border-zinc-100 dark:border-zinc-900">
              <p className="text-base font-bold text-zinc-900 dark:text-zinc-50">
                {profile.jobs_completed || 0}
              </p>
              <p className="text-[10px] font-bold text-zinc-400 uppercase tracking-wider mt-0.5 dark:text-zinc-500">
                {profile.role === "student" ? "Assignments" : "Jobs completed"}
              </p>
            </div>
          </div>
        </div>
      </div>

      {/* Primary Context Container */}
      <div className="mx-auto max-w-md px-4 mt-6 space-y-6">
        
        {/* Dynamic Bio Paragraph */}
        {profile.bio && (
          <div className="text-xs leading-relaxed text-zinc-500 border-l-2 border-zinc-100 pl-3 dark:text-zinc-400 dark:border-zinc-800">
            {profile.bio}
          </div>
        )}

        {/* Tactical UI Actions Menu Group */}
        <div className="space-y-1">
          <p className="text-[10px] font-bold text-zinc-400 dark:text-zinc-600 uppercase tracking-wider px-1">Preferences</p>
          <div className="overflow-hidden rounded-2xl border border-zinc-100 bg-white dark:border-zinc-900/60 dark:bg-zinc-900/10">
            <button
              type="button"
              onClick={toggleTheme}
              className="flex w-full items-center justify-between p-4 text-left transition-colors hover:bg-zinc-50 dark:hover:bg-zinc-900/40"
            >
              <div className="flex items-center gap-3">
                <div className="text-zinc-400 dark:text-zinc-500">
                  {theme === "dark" ? <Moon className="h-4 w-4" /> : <Sun className="h-4 w-4" />}
                </div>
                <div>
                  <p className="text-xs font-semibold text-zinc-800 dark:text-zinc-200">Interface Display</p>
                  <p className="text-[10px] text-zinc-400 dark:text-zinc-500 capitalize">{theme} mode active</p>
                </div>
              </div>
              <div className={`relative h-5 w-9 rounded-full transition-colors ${theme === "dark" ? "bg-zinc-900 dark:bg-zinc-50" : "bg-zinc-200"}`}>
                <span className={`absolute top-0.5 h-4 w-4 rounded-full bg-white transition-transform ${theme === "dark" ? "translate-x-4 dark:bg-zinc-900" : "translate-x-0.5"}`} />
              </div>
            </button>
          </div>
        </div>

        {/* Hardened Payout Routing Configuration Section */}
        <div className="space-y-2">
          <div className="flex items-center gap-1.5 px-1">
            <Wallet className="h-3.5 w-3.5 text-zinc-400" />
            <p className="text-[10px] font-bold text-zinc-400 dark:text-zinc-600 uppercase tracking-wider">Secure Financial Settings</p>
          </div>
          
          <div className="rounded-2xl border border-zinc-100 bg-zinc-50/40 p-4 dark:border-zinc-900 dark:bg-zinc-900/10">
            <p className="text-[11px] leading-normal text-zinc-400 dark:text-zinc-500 mb-3">
              {profile.role === "writer"
                ? "Required to complete automated escrow payouts. All configurations are stored via server-isolated tables."
                : "Optional payout configuration. Restricted to validation returns and cancellation processing."}
            </p>

            {paymentSettings?.upi_id && (
              <div className="mb-3 flex items-center justify-between rounded-xl bg-white border border-zinc-100 px-3 py-2 dark:bg-zinc-950 dark:border-zinc-900">
                <span className="font-mono text-xs font-medium text-zinc-600 dark:text-zinc-300">
                  {showUpi ? paymentSettings.upi_id : maskedUpi}
                </span>
                <button
                  type="button"
                  onClick={() => setShowUpi(!showUpi)}
                  className="text-zinc-400 hover:text-zinc-600 dark:hover:text-zinc-300"
                >
                  {showUpi ? <EyeOff className="h-3.5 w-3.5" /> : <Eye className="h-3.5 w-3.5" />}
                </button>
              </div>
            )}

            <div className="flex gap-2">
              <input
                type="text"
                placeholder="identity@handle"
                value={upiId}
                onChange={(e) => setUpiId(e.target.value)}
                maxLength={100}
                autoCapitalize="none"
                autoCorrect="off"
                className="w-full rounded-xl border border-zinc-100 bg-white px-3 py-2 text-xs font-medium text-zinc-800 placeholder-zinc-300 focus:outline-none dark:border-zinc-800 dark:bg-zinc-900 dark:text-zinc-200"
              />
              <button 
                type="button"
                onClick={handleSaveUpi} 
                disabled={saveUpiMutation.isPending || loadingPayment}
                className="rounded-xl bg-zinc-900 px-4 py-2 text-xs font-semibold text-white transition-opacity disabled:opacity-40 dark:bg-zinc-50 dark:text-zinc-900"
              >
                {saveUpiMutation.isPending ? "..." : "Save"}
              </button>
            </div>
          </div>
        </div>

        {/* Dynamic Context Lists */}
        <div className="space-y-3 pt-2">
          <h2 className="text-xs font-bold text-zinc-400 dark:text-zinc-600 uppercase tracking-wider px-1">
            {profile.role === "student" ? "My posted assignments" : "Active proposals & bids"}
          </h2>
          
          <div className="space-y-3">
            {loadingAssignments ? (
              <div className="flex justify-center py-6">
                <Loader2 className="h-5 w-5 animate-spin text-zinc-300" />
              </div>
            ) : !myAssignments?.length ? (
              <div className="flex flex-col items-center justify-center py-10 rounded-2xl border border-dashed border-zinc-100 text-center dark:border-zinc-900">
                <p className="text-xs font-medium text-zinc-400 dark:text-zinc-500">No history captured yet</p>
              </div>
            ) : (
              myAssignments.map((a) => a && (
                <AssignmentCard key={a.id} a={{
                  id: a.id, 
                  title: a.title, 
                  subject: a.subject,
                  budget_min: a.budget_min, 
                  budget_max: a.budget_max,
                  deadline: a.deadline,
                  bid_count: (a as any).bids?.[0]?.count,
                }} />
              ))
            )}
          </div>
        </div>

        {/* Bottom Utility Boundary Actions */}
        <div className="pt-4 border-t border-zinc-100 dark:border-zinc-900 space-y-4">
          <button
            type="button"
            onClick={signOut}
            className="flex w-full items-center justify-between rounded-xl bg-zinc-50 p-3.5 text-left text-xs font-semibold text-red-500 transition-colors hover:bg-red-50/50 dark:bg-zinc-900/20 dark:text-red-400 dark:hover:bg-red-950/10"
          >
            <div className="flex items-center gap-2">
              <LogOut className="h-4 w-4" />
              <span>Log out active session</span>
            </div>
            <ChevronRight className="h-4 w-4 opacity-40" />
          </button>

          {/* Footer Metadata Navs */}
          <div className="flex flex-wrap justify-center gap-x-4 gap-y-1.5 text-[10px] font-medium text-zinc-400 dark:text-zinc-600">
            {[["About","/about"],["Terms","/terms"],["Privacy","/privacy"],["Refunds","/refund"],["Contact","/contact"]].map(([title, href]) => (
              <a key={href} href={href} className="hover:text-zinc-900 dark:hover:text-zinc-400 transition-colors">{title}</a>
            ))}
          </div>
          <p className="text-center text-[10px] font-medium text-zinc-300 dark:text-zinc-700">
            &copy; {new Date().getFullYear()} AssiMate Platform Architecture
          </p>
        </div>

      </div>
    </div>
  );
}
