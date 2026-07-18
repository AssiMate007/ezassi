import { createFileRoute, useNavigate, Link } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/use-auth";
import { useTheme } from "@/hooks/use-theme";
import { useIsAdmin } from "@/hooks/use-admin";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  Star, LogOut, GraduationCap, PenLine, Wallet,
  CheckCircle2, Eye, EyeOff, Shield, Moon, Sun, Clock,
} from "lucide-react";
import { AssignmentCard } from "@/components/AssignmentCard";
import { toast } from "sonner";

export const Route = createFileRoute("/_app/profile")({
  component: ProfilePage,
});

function Avatar({ name, size = 64 }: { name: string; size?: number }) {
  const initials = name.split(" ").map((w) => w[0]).slice(0, 2).join("").toUpperCase();
  const colors = ["bg-violet-500","bg-fuchsia-500","bg-pink-500","bg-indigo-500","bg-cyan-500"];
  const color = colors[name.charCodeAt(0) % colors.length];
  return (
    <div className={`${color} rounded-2xl flex items-center justify-center font-bold text-white shrink-0 shadow-sm`}
      style={{ width: size, height: size, fontSize: size * 0.34 }}>
      {initials}
    </div>
  );
}

function ProfilePage() {
  const { user, profile, refetchProfile } = useAuth();
  const navigate = useNavigate();
  const isAdmin = useIsAdmin();
  const { theme, toggle: toggleTheme } = useTheme();
  
  // UPI Edit States
  const [upiId, setUpiId] = useState("");
  const [showUpi, setShowUpi] = useState(false);
  const [savingUpi, setSavingUpi] = useState(false);
  const [isEditingUpi, setIsEditingUpi] = useState(false);

  // Username Edit States
  const [isEditingName, setIsEditingName] = useState(false);
  const [tempName, setTempName] = useState("");
  const [savingName, setSavingName] = useState(false);

  // Active Tab
  const [activeTab, setActiveTab] = useState<"assignments" | "payments">("assignments");

  const { data: savedUpi, refetch: refetchUpi } = useQuery({
    queryKey: ["my-upi", user?.id],
    enabled: !!user,
    queryFn: async () => {
      const { data } = await supabase
        .from("user_payout_info")
        .select("upi_id")
        .eq("user_id", user!.id)
        .maybeSingle();
      return data?.upi_id ?? null;
    },
  });

  useEffect(() => {
    setUpiId(savedUpi ?? "");
  }, [savedUpi]);

  const saveName = async () => {
    if (!user) return;
    const trimmed = tempName.trim();
    if (!trimmed) return toast.error("Username cannot be empty");
    if (trimmed.length < 3) return toast.error("Username must be at least 3 characters");
    setSavingName(true);
    const { error } = await supabase.from("profiles").update({ display_name: trimmed }).eq("id", user.id);
    setSavingName(false);
    if (error) return toast.error(error.message);
    toast.success("Username updated ✓");
    setIsEditingName(false);
    refetchProfile();
  };

  const saveUpi = async () => {
    if (!user) return;
    const trimmed = upiId.trim();
    if (trimmed && !/^[\w.\-]{2,256}@[a-zA-Z]{2,64}$/.test(trimmed))
      return toast.error("Enter a valid UPI ID e.g. name@okhdfcbank");
    setSavingUpi(true);
    const { error } = await supabase.from("user_payout_info").upsert(
      { user_id: user.id, upi_id: trimmed || null },
      { onConflict: "user_id" },
    );
    setSavingUpi(false);
    if (error) return toast.error(error.message);
    toast.success("UPI ID saved ✓");
    setIsEditingUpi(false);
    refetchUpi();
  };

  const { data: myAssignments } = useQuery({
    queryKey: ["my-assignments", user?.id, profile?.role],
    enabled: !!profile,
    queryFn: async () => {
      if (!user || !profile) return [];
      if (profile.role === "student") {
        const { data } = await supabase.from("assignments").select("*, bids(count)").eq("student_id", user.id).order("created_at", { ascending: false });
        return data ?? [];
      } else {
        const { data } = await supabase.from("bids").select("*, assignment:assignments(*)").eq("writer_id", user.id).order("created_at", { ascending: false });
        return (data ?? []).map((b) => b.assignment).filter(Boolean);
      }
    },
  });

  const { data: myPayments } = useQuery({
    queryKey: ["my-payments", user?.id, profile?.role],
    enabled: !!profile,
    queryFn: async () => {
      if (!user || !profile) return [];
      const col = profile.role === "student" ? "student_id" : "writer_id";
      const { data, error } = await supabase
        .from("payments")
        .select("*, assignment:assignments(title)")
        .eq(col, user.id)
        .order("created_at", { ascending: false });
      if (error) throw error;
      return data ?? [];
    },
  });

  const signOut = async () => {
    await supabase.auth.signOut();
    navigate({ to: "/auth" });
  };

  if (!profile) return (
    <div className="min-h-screen bg-zinc-50/50 dark:bg-zinc-950 p-4 space-y-3">
      <div className="h-32 rounded-2xl bg-zinc-100 dark:bg-zinc-800 animate-pulse" />
      <div className="h-20 rounded-2xl bg-zinc-100 dark:bg-zinc-800 animate-pulse" />
      <div className="h-20 rounded-2xl bg-zinc-100 dark:bg-zinc-800 animate-pulse" />
    </div>
  );

  const maskedUpi = savedUpi
    ? savedUpi.replace(/^(.{3}).*(@.*)$/, (_: string, a: string, b: string) => `${a}${"•".repeat(6)}${b}`)
    : null;

  return (
    <div className="min-h-screen bg-zinc-50/50 pb-12 dark:bg-zinc-950">
      {/* Header — matches Feed page structure */}
      <header className="border-b border-zinc-100 bg-white px-4 pt-10 pb-8 dark:border-zinc-900 dark:bg-zinc-900/20">
        <div className="mx-auto max-w-3xl">
          <div className="flex items-center gap-4">
            <Avatar name={profile.display_name} size={64} />
            <div className="flex-1 min-w-0">
              {isEditingName ? (
                <div className="flex items-center gap-2 max-w-xs">
                  <Input
                    value={tempName}
                    onChange={(e) => setTempName(e.target.value)}
                    maxLength={50}
                    className="h-8 text-sm px-2 py-1 rounded-lg border-zinc-200 dark:border-zinc-800"
                  />
                  <Button size="sm" onClick={saveName} disabled={savingName} className="h-8 px-3 text-xs rounded-lg shrink-0">
                    {savingName ? "…" : "Save"}
                  </Button>
                  <Button size="sm" variant="ghost" onClick={() => { setIsEditingName(false); setTempName(profile.display_name); }} className="h-8 px-2.5 text-xs rounded-lg shrink-0">
                    Cancel
                  </Button>
                </div>
              ) : (
                <div className="flex items-center gap-2">
                  <h1 className="text-xl font-bold tracking-tight text-zinc-900 dark:text-zinc-50 truncate">
                    {profile.display_name}
                  </h1>
                  <button
                    onClick={() => { setIsEditingName(true); setTempName(profile.display_name); }}
                    className="text-zinc-400 hover:text-zinc-700 dark:hover:text-zinc-200 transition p-1"
                    title="Edit username"
                  >
                    <PenLine className="h-3.5 w-3.5" />
                  </button>
                </div>
              )}
              <div className="mt-1 flex items-center gap-1.5 text-xs text-zinc-500 dark:text-zinc-400">
                {profile.role === "student" ? <GraduationCap className="h-3.5 w-3.5" /> : <PenLine className="h-3.5 w-3.5" />}
                <span className="capitalize">{profile.role}</span>
                {isAdmin && (
                  <>
                    <span className="text-zinc-300 dark:text-zinc-700">•</span>
                    <Link to="/admin" className="inline-flex items-center gap-1 text-indigo-600 dark:text-indigo-400 font-medium">
                      <Shield className="h-3 w-3" />Admin
                    </Link>
                  </>
                )}
              </div>
            </div>
          </div>

          <div className="mt-5 flex gap-6">
            <div>
              <div className="flex items-center gap-1 text-lg font-bold text-zinc-900 dark:text-zinc-50">
                <Star className="h-4 w-4 fill-amber-400 text-amber-400" />
                {Number(profile.rating).toFixed(1)}
              </div>
              <p className="text-xs text-zinc-500 dark:text-zinc-400 mt-0.5">Rating</p>
            </div>
            <div className="w-px bg-zinc-200 dark:bg-zinc-800" />
            <div>
              <div className="text-lg font-bold text-zinc-900 dark:text-zinc-50">{profile.jobs_completed}</div>
              <p className="text-xs text-zinc-500 dark:text-zinc-400 mt-0.5">
                {profile.role === "student" ? "Assignments" : "Jobs done"}
              </p>
            </div>
          </div>
        </div>
      </header>

      <main className="mx-auto max-w-3xl px-4 pt-6 space-y-4">
        {/* Theme toggle */}
        <div className="rounded-2xl border border-zinc-200 bg-white p-4 shadow-sm dark:border-zinc-800 dark:bg-zinc-900">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <div className={`h-9 w-9 rounded-xl flex items-center justify-center ${theme === "dark" ? "bg-zinc-800" : "bg-amber-50"}`}>
                {theme === "dark" ? <Moon className="h-4 w-4 text-blue-400" /> : <Sun className="h-4 w-4 text-amber-500" />}
              </div>
              <div>
                <p className="text-sm font-semibold text-zinc-900 dark:text-zinc-100">{theme === "dark" ? "Dark mode" : "Light mode"}</p>
                <p className="text-xs text-zinc-500 dark:text-zinc-400">Tap to switch</p>
              </div>
            </div>
            <button onClick={toggleTheme}
              className={`relative h-6 w-11 rounded-full transition-colors ${theme === "dark" ? "bg-zinc-900 dark:bg-zinc-100" : "bg-zinc-200 dark:bg-zinc-700"}`}
              aria-label="Toggle theme">
              <span className={`absolute top-1 left-1 h-4 w-4 rounded-full bg-white dark:bg-zinc-900 shadow transition-transform duration-300 ${theme === "dark" ? "translate-x-5" : "translate-x-0"}`} />
            </button>
          </div>
        </div>

        {/* Bio */}
        {profile.bio && (
          <div className="rounded-2xl border border-zinc-200 bg-white p-4 shadow-sm dark:border-zinc-800 dark:bg-zinc-900">
            <p className="text-sm text-zinc-600 dark:text-zinc-400">{profile.bio}</p>
          </div>
        )}

        {/* UPI */}
        <div className="rounded-2xl border border-zinc-200 bg-white p-4 shadow-sm dark:border-zinc-800 dark:bg-zinc-900">
          <div className="flex items-center gap-2 mb-1.5">
            <div className="h-8 w-8 rounded-xl bg-zinc-900 dark:bg-zinc-100 flex items-center justify-center">
              <Wallet className="h-4 w-4 text-white dark:text-zinc-900" />
            </div>
            <h3 className="font-semibold text-sm flex-1 text-zinc-900 dark:text-zinc-100">UPI for payouts</h3>
            {profile.upi_id && <CheckCircle2 className="h-4 w-4 text-emerald-500" />}
          </div>
          <p className="text-xs text-zinc-500 dark:text-zinc-400 mb-3">
            {profile.role === "writer" ? "Required to receive your 85% payout." : "Used for secure escrow refunds."}
          </p>
          
          {profile.upi_id && !isEditingUpi ? (
            <div className="flex flex-col gap-2">
              <div className="flex items-center gap-2 bg-zinc-50 dark:bg-zinc-800/60 rounded-xl px-3 py-2 border border-zinc-100 dark:border-zinc-800">
                <span className="text-sm font-mono text-zinc-700 dark:text-zinc-300 flex-1">{showUpi ? profile.upi_id : maskedUpi}</span>
                <button onClick={() => setShowUpi(!showUpi)} className="text-zinc-400 hover:text-zinc-700 dark:hover:text-zinc-200 transition p-1">
                  {showUpi ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                </button>
              </div>
              <Button 
                variant="outline" 
                onClick={() => { setIsEditingUpi(true); setUpiId(profile.upi_id ?? ""); }}
                className="w-full h-9 text-xs rounded-xl border-zinc-200 dark:border-zinc-800 text-zinc-700 dark:text-zinc-300"
              >
                Edit UPI ID
              </Button>
            </div>
          ) : (
            <div className="space-y-2">
              <div className="flex gap-2">
                <Input placeholder="yourname@okhdfcbank" value={upiId} onChange={(e) => setUpiId(e.target.value)}
                  maxLength={100} autoCapitalize="none" autoCorrect="off"
                  className="rounded-xl border-zinc-200 dark:border-zinc-800" />
                <Button onClick={saveUpi} disabled={savingUpi}
                  className="bg-zinc-900 hover:bg-zinc-800 dark:bg-zinc-100 dark:text-zinc-950 dark:hover:bg-zinc-200 rounded-xl shrink-0">
                  {savingUpi ? "…" : "Save"}
                </Button>
              </div>
              {profile.upi_id && (
                <Button 
                  variant="ghost" 
                  onClick={() => setIsEditingUpi(false)}
                  className="w-full h-8 text-xs text-muted-foreground hover:text-zinc-900 rounded-xl"
                >
                  Cancel
                </Button>
              )}
            </div>
          )}
        </div>

        {/* Navigation Tabs */}
        <div className="flex border-b border-zinc-200 dark:border-zinc-800 mt-2">
          <button
            onClick={() => setActiveTab("assignments")}
            className={`flex-1 py-3 text-sm font-semibold border-b-2 transition ${
              activeTab === "assignments"
                ? "border-primary text-zinc-900 dark:text-zinc-50"
                : "border-transparent text-zinc-400 hover:text-zinc-700 dark:hover:text-zinc-300"
            }`}
          >
            {profile.role === "student" ? "My Assignments" : "My Bids"}
          </button>
          <button
            onClick={() => setActiveTab("payments")}
            className={`flex-1 py-3 text-sm font-semibold border-b-2 transition ${
              activeTab === "payments"
                ? "border-primary text-zinc-900 dark:text-zinc-50"
                : "border-transparent text-zinc-400 hover:text-zinc-700 dark:hover:text-zinc-300"
            }`}
          >
            Payment History
          </button>
        </div>

        {activeTab === "assignments" ? (
          <div>
            <div className="space-y-3">
              {!myAssignments?.length ? (
                <div className="rounded-2xl border border-dashed border-zinc-200 bg-white px-4 py-12 text-center dark:border-zinc-800 dark:bg-zinc-900/20">
                  <div className="mx-auto flex h-12 w-12 items-center justify-center rounded-xl bg-zinc-50 text-xl dark:bg-zinc-900">📭</div>
                  <p className="text-sm text-zinc-500 dark:text-zinc-400 mt-3">Nothing here yet</p>
                </div>
              ) : myAssignments.map((a) => a && (
                <AssignmentCard key={a.id} a={{
                  id: a.id, title: a.title, subject: a.subject,
                  budget_min: a.budget_min, budget_max: a.budget_max, deadline: a.deadline,
                  bid_count: (a as any).bids?.[0]?.count,
                }} />
              ))}
            </div>
          </div>
        ) : (
          <div className="space-y-3">
            {!myPayments?.length ? (
              <div className="rounded-2xl border border-dashed border-zinc-200 bg-white px-4 py-12 text-center dark:border-zinc-800 dark:bg-zinc-900/20">
                <div className="mx-auto flex h-12 w-12 items-center justify-center rounded-xl bg-zinc-50 text-xl dark:bg-zinc-900">💳</div>
                <p className="text-sm text-zinc-500 dark:text-zinc-400 mt-3">No payments history yet</p>
              </div>
            ) : myPayments.map((p) => (
              <div key={p.id} className="rounded-2xl border border-zinc-200 bg-white p-4 dark:border-zinc-800 dark:bg-zinc-900 shadow-sm flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                <div className="space-y-1">
                  <h4 className="font-bold text-sm text-zinc-900 dark:text-zinc-100">{p.assignment?.title || "Assignment Payment"}</h4>
                  <p className="text-xs text-zinc-400 dark:text-zinc-500">
                    {new Date(p.created_at).toLocaleString()}
                  </p>
                </div>
                <div className="flex items-center gap-3 justify-between sm:justify-end">
                  <div className="text-right">
                    <p className="font-extrabold text-base text-zinc-900 dark:text-zinc-50">
                      ₹{profile.role === "student" ? p.amount : p.writer_payout}
                    </p>
                    <p className="text-[10px] text-zinc-400 dark:text-zinc-500">
                      {profile.role === "student" ? "Paid" : "Received"}
                    </p>
                  </div>
                  <span className={`inline-flex items-center gap-1 text-[11px] font-semibold px-2.5 py-1 rounded-full border ${
                    p.status === "file_delivered" ? "bg-emerald-50 text-emerald-700 border-emerald-200 dark:bg-emerald-950/20 dark:text-emerald-400 dark:border-emerald-900/40" :
                    p.status === "payment_received" ? "bg-indigo-50 text-indigo-700 border-indigo-200 dark:bg-indigo-950/20 dark:text-indigo-400 dark:border-indigo-900/40" :
                    "bg-amber-50 text-amber-700 border-amber-200 dark:bg-amber-950/20 dark:text-amber-400 dark:border-amber-900/40"
                  }`}>
                    {p.status.replace(/_/g, " ")}
                  </span>
                </div>
              </div>
            ))}
          </div>
        )}

        {/* Sign out */}
        <Button variant="outline" onClick={signOut}
          className="w-full rounded-xl mt-2 border-zinc-200 text-zinc-600 hover:bg-zinc-50 dark:border-zinc-800 dark:text-zinc-400 dark:hover:bg-zinc-900">
          <LogOut className="h-4 w-4 mr-2" />Sign out
        </Button>

        {/* Footer */}
        <div className="pt-4 border-t border-zinc-100 dark:border-zinc-900 flex flex-wrap justify-center gap-x-4 gap-y-2 text-xs text-zinc-400 dark:text-zinc-500">
          {[["About","/about"],["Terms","/terms"],["Privacy","/privacy"],["Refunds","/refund"],["Contact","/contact"]].map(([l,h]) => (
            <a key={h} href={h} className="hover:text-zinc-700 dark:hover:text-zinc-300 transition">{l}</a>
          ))}
        </div>
        <p className="text-center text-[11px] text-zinc-400 dark:text-zinc-600">© {new Date().getFullYear()} AssiMate</p>
      </main>
    </div>
  );
}
