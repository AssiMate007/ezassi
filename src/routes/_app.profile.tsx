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
  CheckCircle2, Eye, EyeOff, Shield, Moon, Sun,
} from "lucide-react";
import { AssignmentCard } from "@/components/AssignmentCard";
import { toast } from "sonner";

export const Route = createFileRoute("/_app/profile")({
  component: ProfilePage,
});

function Avatar({ name, size = 80 }: { name: string; size?: number }) {
  const initials = name.split(" ").map((w) => w[0]).slice(0, 2).join("").toUpperCase();
  return (
    <div
      className="rounded-full flex items-center justify-center font-bold text-white bg-gradient-primary ring-4 ring-white/30 shadow-glow"
      style={{ width: size, height: size, fontSize: size * 0.34 }}
    >
      {initials}
    </div>
  );
}

function ProfilePage() {
  const { user, profile } = useAuth();
  const navigate = useNavigate();
  const isAdmin = useIsAdmin();
  const { theme, toggle: toggleTheme } = useTheme();
  const [upiId, setUpiId] = useState("");
  const [showUpi, setShowUpi] = useState(false);
  const [savingUpi, setSavingUpi] = useState(false);

  useEffect(() => {
    if (profile?.upi_id !== undefined) setUpiId(profile.upi_id ?? "");
  }, [profile]);

  const saveUpi = async () => {
    if (!user) return;
    const trimmed = upiId.trim();
    if (trimmed && !/^[\w.\-]{2,256}@[a-zA-Z]{2,64}$/.test(trimmed))
      return toast.error("Enter a valid UPI ID e.g. name@okhdfcbank");
    setSavingUpi(true);
    const { error } = await supabase
      .from("profiles")
      .update({ upi_id: trimmed || null } as never)
      .eq("id", user.id);
    setSavingUpi(false);
    if (error) return toast.error(error.message);
    toast.success("UPI ID saved ✓");
  };

  const { data: myAssignments } = useQuery({
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

  if (!profile) return (
    <div className="p-8 space-y-3">
      <div className="h-20 rounded-xl shimmer" />
      <div className="h-10 rounded-xl shimmer" />
      <div className="h-6 rounded-xl shimmer" />
    </div>
  );

  const maskedUpi = profile.upi_id
    ? profile.upi_id.replace(/^(.{3}).*(@.*)$/, (_, a, b) => `${a}${"•".repeat(6)}${b}`)
    : null;

  return (
    <div className="pb-4">
      {/* Hero */}
      <div className="bg-gradient-hero px-4 pt-12 pb-20 text-primary-foreground relative overflow-hidden">
        <div className="absolute inset-0 bg-black/5" />
        <div className="absolute -top-10 -right-10 w-48 h-48 rounded-full bg-white/10 blur-3xl pointer-events-none" />
        <div className="relative flex flex-col items-center text-center">
          <Avatar name={profile.display_name} size={84} />
          <h1 className="mt-4 text-2xl font-bold">{profile.display_name}</h1>
          <div className="mt-1.5 flex items-center gap-1.5 text-sm text-primary-foreground/85">
            {profile.role === "student"
              ? <GraduationCap className="h-4 w-4" />
              : <PenLine className="h-4 w-4" />}
            <span className="capitalize font-medium">{profile.role}</span>
          </div>
          {isAdmin && (
            <Link to="/admin" className="mt-2 flex items-center gap-1.5 text-xs bg-white/20 backdrop-blur-sm border border-white/30 px-3 py-1.5 rounded-full font-semibold">
              <Shield className="h-3.5 w-3.5" /> Admin Panel
            </Link>
          )}
          <div className="mt-5 flex gap-8">
            <div className="text-center">
              <div className="flex items-center justify-center gap-1 text-xl font-bold">
                <Star className="h-4 w-4 fill-yellow-300 text-yellow-300" />
                {Number(profile.rating).toFixed(1)}
              </div>
              <p className="text-xs text-primary-foreground/70 mt-0.5">Rating</p>
            </div>
            <div className="w-px bg-white/25" />
            <div className="text-center">
              <div className="text-xl font-bold">{profile.jobs_completed}</div>
              <p className="text-xs text-primary-foreground/70 mt-0.5">
                {profile.role === "student" ? "Assignments" : "Jobs done"}
              </p>
            </div>
          </div>
        </div>
      </div>

      <div className="px-4 -mt-10 relative z-10 space-y-4">
        {/* Dark mode toggle card */}
        <div className="bg-card rounded-3xl p-4 shadow-card border border-border">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <div className={`h-10 w-10 rounded-2xl flex items-center justify-center shadow-soft ${theme === "dark" ? "bg-slate-800" : "bg-amber-50"}`}>
                {theme === "dark"
                  ? <Moon className="h-5 w-5 text-blue-400" />
                  : <Sun className="h-5 w-5 text-amber-500" />}
              </div>
              <div>
                <p className="font-semibold text-sm">{theme === "dark" ? "Dark mode" : "Light mode"}</p>
                <p className="text-xs text-muted-foreground">Tap to switch</p>
              </div>
            </div>
            <button
              onClick={toggleTheme}
              className={`relative h-7 rounded-full transition-colors duration-300 focus:outline-none ${theme === "dark" ? "bg-primary" : "bg-muted"}`}
              style={{ width: 52 }}
              aria-label="Toggle theme"
            >
              <span className={`absolute top-1 h-5 w-5 rounded-full bg-white shadow transition-transform duration-300 ${theme === "dark" ? "translate-x-6" : "translate-x-1"}`} />
            </button>
          </div>
        </div>

        {/* Bio */}
        {profile.bio && (
          <div className="bg-card rounded-3xl p-4 shadow-card border border-border">
            <p className="text-sm text-muted-foreground">{profile.bio}</p>
          </div>
        )}

        {/* UPI */}
        <div className="bg-card rounded-3xl p-4 shadow-card border border-border">
          <div className="flex items-center gap-2 mb-1.5">
            <div className="h-8 w-8 rounded-xl bg-gradient-primary flex items-center justify-center shadow-soft">
              <Wallet className="h-4 w-4 text-primary-foreground" />
            </div>
            <h3 className="font-semibold text-sm flex-1">UPI for payouts</h3>
            {profile.upi_id && <CheckCircle2 className="h-4 w-4 text-success" />}
          </div>
          <p className="text-xs text-muted-foreground mb-3">
            {profile.role === "writer" ? "Required to receive your 85% payout." : "Optional — for refunds only."}
          </p>
          {profile.upi_id && (
            <div className="mb-3 flex items-center gap-2 bg-muted/60 rounded-xl px-3 py-2">
              <span className="text-sm font-mono text-foreground flex-1">
                {showUpi ? profile.upi_id : maskedUpi}
              </span>
              <button onClick={() => setShowUpi(!showUpi)} className="text-muted-foreground hover:text-foreground transition">
                {showUpi ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
              </button>
            </div>
          )}
          <div className="flex gap-2">
            <Input
              placeholder="yourname@okhdfcbank"
              value={upiId}
              onChange={(e) => setUpiId(e.target.value)}
              maxLength={100}
              autoCapitalize="none"
              autoCorrect="off"
              className="rounded-xl"
            />
            <Button onClick={saveUpi} disabled={savingUpi} className="bg-gradient-primary rounded-xl shrink-0">
              {savingUpi ? "…" : "Save"}
            </Button>
          </div>
        </div>

        {/* Assignments */}
        <div>
          <h2 className="font-bold text-base mb-3">
            {profile.role === "student" ? "My assignments" : "My bids"}
          </h2>
          <div className="space-y-3">
            {!myAssignments?.length ? (
              <div className="text-center py-10 bg-card rounded-3xl border border-border">
                <div className="text-4xl mb-2">📭</div>
                <p className="text-sm text-muted-foreground">Nothing here yet</p>
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

        {/* Sign out */}
        <Button variant="outline" onClick={signOut} className="w-full rounded-2xl mt-2 text-muted-foreground">
          <LogOut className="h-4 w-4 mr-2" />Sign out
        </Button>

        {/* Footer links */}
        <div className="pt-4 border-t border-border flex flex-wrap justify-center gap-x-4 gap-y-2 text-xs text-muted-foreground">
          {[["About","/about"],["Terms","/terms"],["Privacy","/privacy"],["Refunds","/refund"],["Contact","/contact"]].map(([l,h])=>(
            <a key={h} href={h} className="hover:text-primary transition">{l}</a>
          ))}
        </div>
        <p className="text-center text-[11px] text-muted-foreground">© {new Date().getFullYear()} AssiMate</p>
      </div>
    </div>
  );
}
